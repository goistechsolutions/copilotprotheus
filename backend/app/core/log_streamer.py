import logging
import asyncio
from typing import AsyncGenerator
import json
import time

class AsyncQueueHandler(logging.Handler):
    def __init__(self, queue: asyncio.Queue):
        super().__init__()
        self.queue = queue
        self.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(name)s - %(message)s'))

    def emit(self, record: logging.LogRecord):
        try:
            msg = self.format(record)
            # Tenta inserir na fila sem bloquear
            try:
                self.queue.put_nowait(msg)
            except (asyncio.QueueFull, RuntimeError):
                pass
        except Exception:
            self.handleError(record)

class LogStreamManager:
    def __init__(self):
        self.listeners = []
        self._setup_handler()

    def _setup_handler(self):
        self.queue = asyncio.Queue(maxsize=1000)
        self.handler = AsyncQueueHandler(self.queue)
        
        # Anexa ao logger raiz ou app
        root_logger = logging.getLogger("app")
        root_logger.setLevel(logging.INFO)
        root_logger.addHandler(self.handler)
        
        self.task = None

    async def _fanout_loop(self):
        while True:
            try:
                msg = await self.queue.get()
                dead_listeners = []
                for q in self.listeners:
                    try:
                        q.put_nowait(msg)
                    except asyncio.QueueFull:
                        pass
                    except Exception:
                        dead_listeners.append(q)
                        
                for q in dead_listeners:
                    if q in self.listeners:
                        self.listeners.remove(q)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Log fanout error: {e}")

    def start_background_task(self):
        if self.task is None:
            self.task = asyncio.create_task(self._fanout_loop())

    async def subscribe(self) -> AsyncGenerator[str, None]:
        self.start_background_task()
        q = asyncio.Queue(maxsize=500)
        self.listeners.append(q)
        try:
            while True:
                msg = await q.get()
                yield f"data: {json.dumps({'message': msg, 'timestamp': time.time()})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if q in self.listeners:
                self.listeners.remove(q)

stream_manager = LogStreamManager()
