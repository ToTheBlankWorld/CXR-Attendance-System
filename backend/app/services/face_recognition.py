import numpy as np
import cv2
import os
import pickle
from typing import Optional, List, Dict, Tuple
from insightface.app import FaceAnalysis
from numpy.linalg import norm
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class FaceRecognitionService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        logger.info("Initializing InsightFace with ArcFace model...")
        
        # Initialize InsightFace with buffalo_l model (includes ArcFace)
        self.app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
        self.app.prepare(ctx_id=0, det_size=(640, 640))
        
        self._initialized = True
        self._embeddings_cache: Dict[str, np.ndarray] = {}
        self._class_embeddings: Dict[str, np.ndarray] = {}
        self._cooldown_tracker: Dict[str, float] = {}
        self._unknown_cooldown_tracker: Dict[str, float] = {}
        
        logger.info("InsightFace initialized successfully!")
    
    def detect_faces(self, image: np.ndarray) -> List:
        """Detect faces in an image and return face objects"""
        faces = self.app.get(image)
        return faces
    
    def get_embedding(self, image: np.ndarray) -> Optional[np.ndarray]:
        """Extract face embedding from an image"""
        faces = self.detect_faces(image)
        if len(faces) == 0:
            return None
        # Return embedding of the largest face
        largest_face = max(faces, key=lambda x: (x.bbox[2] - x.bbox[0]) * (x.bbox[3] - x.bbox[1]))
        return largest_face.embedding
    
    def get_all_faces_with_embeddings(self, image: np.ndarray) -> List[Tuple[np.ndarray, np.ndarray]]:
        """Get all faces with their embeddings and bounding boxes"""
        faces = self.detect_faces(image)
        results = []
        for face in faces:
            bbox = face.bbox.astype(int)
            embedding = face.embedding
            results.append((bbox, embedding))
        return results
    
    def compute_average_embedding(self, images: List[np.ndarray]) -> Optional[np.ndarray]:
        """Compute average embedding from multiple images"""
        embeddings = []
        for img in images:
            emb = self.get_embedding(img)
            if emb is not None:
                embeddings.append(emb)
        
        if len(embeddings) == 0:
            return None
        
        # Average the embeddings
        avg_embedding = np.mean(embeddings, axis=0)
        # Normalize the average embedding
        avg_embedding = avg_embedding / norm(avg_embedding)
        return avg_embedding
    
    def cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        return float(np.dot(emb1, emb2) / (norm(emb1) * norm(emb2)))
    
    def save_embedding(self, name: str, embedding: np.ndarray) -> bool:
        try:
            os.makedirs(settings.EMBEDDINGS_PATH, exist_ok=True)
            filepath = os.path.join(settings.EMBEDDINGS_PATH, f"{name}.npy")
            np.save(filepath, embedding)
            self._embeddings_cache[name] = embedding
            logger.info(f"Saved embedding for {name}")
            return True
        except Exception as e:
            logger.error(f"Error saving embedding: {e}")
            return False
    
    def load_embedding(self, name: str) -> Optional[np.ndarray]:
        if name in self._embeddings_cache:
            return self._embeddings_cache[name]
        
        filepath = os.path.join(settings.EMBEDDINGS_PATH, f"{name}.npy")
        if os.path.exists(filepath):
            embedding = np.load(filepath)
            self._embeddings_cache[name] = embedding
            return embedding
        return None
    
    def load_class_embeddings(self, names: List[str], clear_first: bool = True) -> Dict[str, np.ndarray]:
        if clear_first:
            self._class_embeddings = {}
        
        for n in names:
            emb = self.load_embedding(n)
            if emb is not None:
                self._class_embeddings[n] = emb
        logger.info(f"Loaded {len(self._class_embeddings)} embeddings total (clear={clear_first})")
        return self._class_embeddings
    
    def recognize_face(self, embedding: np.ndarray, threshold: float = None) -> Optional[Tuple[str, float]]:
        if threshold is None:
            threshold = settings.SIMILARITY_THRESHOLD
        
        best_match = None
        best_similarity = -1
        
        for student_name, stored_emb in self._class_embeddings.items():
            similarity = self.cosine_similarity(embedding, stored_emb)
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = student_name
        
        if best_match and best_similarity >= threshold:
            return (best_match, best_similarity)
        return None
    
    def process_frame_for_recognition(self, frame: np.ndarray) -> List[Dict]:
        results = []
        faces_data = self.get_all_faces_with_embeddings(frame)
        
        for bbox, embedding in faces_data:
            match = self.recognize_face(embedding)
            result = {
                "bbox": bbox.tolist(),
                "recognized": match is not None,
                "embedding": embedding
            }
            if match:
                student_name, confidence = match
                result["name"] = student_name
                result["confidence"] = confidence
            results.append(result)
        
        return results
    
    def check_cooldown(self, student_name: str, cooldown_seconds: int = None) -> bool:
        import time
        if cooldown_seconds is None:
            cooldown_seconds = settings.RECOGNITION_COOLDOWN
        
        current_time = time.time()
        if student_name in self._cooldown_tracker:
            last_time = self._cooldown_tracker[student_name]
            if current_time - last_time < cooldown_seconds:
                return True
        return False
    
    def set_cooldown(self, student_name: str):
        import time
        self._cooldown_tracker[student_name] = time.time()
    
    def clear_cooldowns(self):
        """Clear all cooldowns"""
        self._cooldown_tracker = {}
    
    def check_unknown_cooldown(self, lecture_id: str, embedding: np.ndarray, cooldown_seconds: int = 120, similarity_threshold: float = 0.5) -> bool:
        """
        Check if similar unknown face is in cooldown period for this lecture.
        Uses cosine similarity to identify similar faces.
        """
        import time
        
        current_time = time.time()
        
        # Check all stored unknown embeddings for this lecture
        for key, (stored_emb, last_time) in list(self._unknown_cooldown_tracker.items()):
            if not key.startswith(f"{lecture_id}_"):
                continue
            
            # Remove expired cooldowns
            if current_time - last_time >= cooldown_seconds:
                del self._unknown_cooldown_tracker[key]
                continue
            
            # Compare embeddings using cosine similarity
            similarity = self.cosine_similarity(embedding, stored_emb)
            if similarity >= similarity_threshold:
                # Similar face found and still in cooldown
                return True
        
        return False
    
    def set_unknown_cooldown(self, lecture_id: str, embedding: np.ndarray):
        """Set cooldown for an unknown face"""
        import time
        import uuid
        # Use UUID to make unique key
        key = f"{lecture_id}_{uuid.uuid4().hex[:8]}"
        self._unknown_cooldown_tracker[key] = (embedding, time.time())
    
    def clear_unknown_cooldowns(self):
        """Clear all unknown face cooldowns"""
        self._unknown_cooldown_tracker = {}

# Singleton instance
face_service = FaceRecognitionService()
