import os
import pika
import json
from app.video_analyzer import analyze_video

RABBITMQ_HOST = os.environ.get("RABBITMQ_HOST", "rabbitmq")
QUEUE_NAME = "video_tasks"
RESULT_QUEUE = "video_results"

def callback(ch, method, properties, body):
    message = json.loads(body)
    video_filename = message.get("filename")
    print(f"[x] Received task: {video_filename}")

    # Perform video analysis
    result = analyze_video(video_filename)
    print(f"[✓] Analysis complete: {result}")

    # TODO: send results back to a results queue or store in DB

    ch.basic_ack(delivery_tag=method.delivery_tag)

def start_consumer():
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host=RABBITMQ_HOST)
    )
    channel = connection.channel()
    channel.queue_declare(queue=QUEUE_NAME, durable=True)

    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=QUEUE_NAME, on_message_callback=callback)

    print("[*] Waiting for video tasks. To exit press CTRL+C")
    channel.start_consuming()

def send_result(channel, result):
    channel.basic_publish(
        exchange="",
        routing_key=RESULT_QUEUE,
        body=json.dumps(result),
        properties=pika.BasicProperties(delivery_mode=2)
    )