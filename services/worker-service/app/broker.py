"""Single TaskIQ broker + scheduler shared by every task module in this service.

The scheduler is picked up by the `taskiq scheduler app.main:scheduler`
command in docker-compose. `LabelScheduleSource` reads the `schedule=[...]`
label that `@broker.task` tasks declare.
"""
from __future__ import annotations

from taskiq import TaskiqScheduler
from taskiq.schedule_sources import LabelScheduleSource
from taskiq_redis import ListQueueBroker, RedisAsyncResultBackend

from eai_common.settings import Settings

settings = Settings(service_name="worker-service")  # type: ignore[call-arg]

broker = ListQueueBroker(url=settings.redis_url).with_result_backend(
    RedisAsyncResultBackend(redis_url=settings.redis_url)
)

scheduler = TaskiqScheduler(broker=broker, sources=[LabelScheduleSource(broker)])
