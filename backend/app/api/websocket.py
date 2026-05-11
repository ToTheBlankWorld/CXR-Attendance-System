from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Dict
import json
import asyncio
from datetime import datetime

router = APIRouter(tags=["WebSocket"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, lecture_id: str):
        await websocket.accept()
        if lecture_id not in self.active_connections:
            self.active_connections[lecture_id] = []
        self.active_connections[lecture_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, lecture_id: str):
        if lecture_id in self.active_connections:
            if websocket in self.active_connections[lecture_id]:
                self.active_connections[lecture_id].remove(websocket)
    
    async def broadcast(self, lecture_id: str, message: dict):
        if lecture_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[lecture_id]:
                try:
                    await connection.send_json(message)
                except:
                    disconnected.append(connection)
            
            # Clean up disconnected clients
            for conn in disconnected:
                self.active_connections[lecture_id].remove(conn)
    
    async def send_notification(self, lecture_id: str, notification_type: str, data: dict):
        message = {
            "type": notification_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }
        await self.broadcast(lecture_id, message)

manager = ConnectionManager()

@router.websocket("/ws/{lecture_id}")
async def websocket_endpoint(websocket: WebSocket, lecture_id: str):
    await manager.connect(websocket, lecture_id)
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            
            # Echo back for testing
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket, lecture_id)

# Export manager for use in other modules
def get_ws_manager():
    return manager
