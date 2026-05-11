from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Tuple
from app.models.models import UnknownFaceTracking
import numpy as np
import uuid
import logging

logger = logging.getLogger(__name__)

# In-memory tracking for active unknown faces
# Key: tracking_id, Value: (embedding, last_seen_timestamp)
_active_unknown_faces: Dict[str, Tuple[np.ndarray, float]] = {}

class UnknownTrackingService:
    """Service for tracking unknown faces with entry/exit times"""
    
    SIMILARITY_THRESHOLD = 0.5  # Same person if similarity >= this
    LEAVE_TIMEOUT_SECONDS = 30  # Mark as left if not seen for this long
    
    def cosine_similarity(self, emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        from numpy.linalg import norm
        return float(np.dot(emb1, emb2) / (norm(emb1) * norm(emb2)))
    
    def find_matching_tracking(
        self, 
        lecture_id: str, 
        embedding: np.ndarray, 
        date: str
    ) -> Optional[str]:
        """Find existing tracking_id for a similar face (in memory)"""
        import time
        current_time = time.time()
        
        for tracking_id, (stored_emb, last_seen) in list(_active_unknown_faces.items()):
            # Only check faces for this lecture
            if not tracking_id.startswith(f"{lecture_id}_"):
                continue
            
            # Check similarity
            similarity = self.cosine_similarity(embedding, stored_emb)
            if similarity >= self.SIMILARITY_THRESHOLD:
                return tracking_id
        
        return None
    
    async def track_unknown_face(
        self,
        db: AsyncSession,
        lecture_id: str,
        embedding: np.ndarray,
        image_path: Optional[str] = None
    ) -> Tuple[UnknownFaceTracking, bool]:
        """
        Track an unknown face. Returns (tracking_record, is_new).
        If face already tracked, updates last_seen_at.
        If new face, creates new tracking record.
        """
        import time
        
        date = datetime.now().strftime("%Y-%m-%d")
        now = datetime.now()
        current_timestamp = time.time()
        
        # Check if this face is already being tracked
        existing_tracking_id = self.find_matching_tracking(lecture_id, embedding, date)
        
        if existing_tracking_id:
            # Update existing tracking
            result = await db.execute(
                select(UnknownFaceTracking).where(
                    UnknownFaceTracking.tracking_id == existing_tracking_id
                )
            )
            tracking = result.scalar_one_or_none()
            
            if tracking:
                tracking.last_seen_at = now
                tracking.status = "present"
                await db.commit()
                await db.refresh(tracking)
                
                # Update in-memory cache
                _active_unknown_faces[existing_tracking_id] = (embedding, current_timestamp)
                
                logger.info(f"Updated unknown face {existing_tracking_id}, still present")
                return tracking, False
        
        # New unknown face - create tracking record
        tracking_id = f"{lecture_id}_{uuid.uuid4().hex[:12]}"
        
        tracking = UnknownFaceTracking(
            lecture_id=lecture_id,
            tracking_id=tracking_id,
            image_path=image_path,
            embedding_blob=embedding.tobytes(),
            entry_time=now,
            last_seen_at=now,
            status="present",
            date=date
        )
        
        db.add(tracking)
        await db.commit()
        await db.refresh(tracking)
        
        # Add to in-memory cache
        _active_unknown_faces[tracking_id] = (embedding, current_timestamp)
        
        logger.info(f"New unknown face tracked: {tracking_id}, entry_time: {now}")
        return tracking, True
    
    async def check_and_mark_left(
        self,
        db: AsyncSession,
        lecture_id: str
    ) -> List[UnknownFaceTracking]:
        """
        Check for unknown faces that haven't been seen recently and mark them as left.
        Returns list of faces that were marked as left.
        """
        import time
        
        current_timestamp = time.time()
        now = datetime.now()
        marked_left = []
        
        # Check all active unknown faces for this lecture
        for tracking_id, (embedding, last_seen) in list(_active_unknown_faces.items()):
            if not tracking_id.startswith(f"{lecture_id}_"):
                continue
            
            # Check if timed out
            if current_timestamp - last_seen >= self.LEAVE_TIMEOUT_SECONDS:
                # Mark as left in database
                result = await db.execute(
                    select(UnknownFaceTracking).where(
                        UnknownFaceTracking.tracking_id == tracking_id
                    )
                )
                tracking = result.scalar_one_or_none()
                
                if tracking and tracking.status == "present":
                    tracking.exit_time = now
                    tracking.status = "left"
                    
                    # Calculate duration
                    duration = (tracking.exit_time - tracking.entry_time).total_seconds()
                    tracking.duration_seconds = int(duration)
                    
                    await db.commit()
                    await db.refresh(tracking)
                    
                    marked_left.append(tracking)
                    logger.info(f"Unknown face {tracking_id} left after {duration:.0f}s")
                
                # Remove from in-memory cache
                del _active_unknown_faces[tracking_id]
        
        return marked_left
    
    async def get_unknown_tracking_logs(
        self,
        db: AsyncSession,
        lecture_id: Optional[str] = None,
        date: Optional[str] = None
    ) -> List[UnknownFaceTracking]:
        """Get unknown face tracking logs with optional filters"""
        query = select(UnknownFaceTracking)
        
        conditions = []
        if lecture_id:
            conditions.append(UnknownFaceTracking.lecture_id == lecture_id)
        if date:
            conditions.append(UnknownFaceTracking.date == date)
        
        if conditions:
            query = query.where(and_(*conditions))
        
        query = query.order_by(UnknownFaceTracking.entry_time.desc())
        
        result = await db.execute(query)
        return result.scalars().all()
    
    async def get_active_unknown_count(self, lecture_id: str) -> int:
        """Get count of currently active unknown faces in a lecture"""
        count = sum(
            1 for tracking_id in _active_unknown_faces.keys()
            if tracking_id.startswith(f"{lecture_id}_")
        )
        return count
    
    def clear_lecture_tracking(self, lecture_id: str):
        """Clear in-memory tracking for a lecture (when attendance stops)"""
        to_remove = [
            tracking_id for tracking_id in _active_unknown_faces.keys()
            if tracking_id.startswith(f"{lecture_id}_")
        ]
        for tracking_id in to_remove:
            del _active_unknown_faces[tracking_id]
        
        logger.info(f"Cleared {len(to_remove)} active unknown faces for lecture {lecture_id}")
    
    def format_duration(self, seconds: int) -> str:
        """Format duration in human-readable format"""
        if seconds < 60:
            return f"{seconds}s"
        elif seconds < 3600:
            mins = seconds // 60
            secs = seconds % 60
            return f"{mins}m {secs}s"
        else:
            hours = seconds // 3600
            mins = (seconds % 3600) // 60
            return f"{hours}h {mins}m"

unknown_tracking_service = UnknownTrackingService()
