import os
import boto3
from botocore.config import Config

class R2Client:
    def __init__(self):
        self.endpoint_url = os.getenv("R2_ENDPOINT_URL")
        self.access_key_id = os.getenv("R2_ACCESS_KEY_ID")
        self.secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
        self.bucket_name = os.getenv("R2_BUCKET_NAME", "copilot-knowledge")
        
        # Desativa warnings de SSL se verify=False for usado
        import urllib3
        urllib3.disable_warnings()

        self.s3 = boto3.client(
            's3',
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key_id,
            aws_secret_access_key=self.secret_access_key,
            config=Config(signature_version='s3v4'),
            region_name='auto',
            verify=False  # Fallback de compatibilidade para ambientes Windows locales
        )

    def upload_file(self, file_path: str, object_name: str) -> bool:
        try:
            self.s3.upload_file(file_path, self.bucket_name, object_name)
            return True
        except Exception as e:
            print(f"Error uploading file to R2: {e}")
            return False

    def download_file(self, object_name: str, file_path: str) -> bool:
        try:
            self.s3.download_file(self.bucket_name, object_name, file_path)
            return True
        except Exception as e:
            print(f"Error downloading file from R2: {e}")
            return False
            
    def list_files(self) -> list:
        try:
            response = self.s3.list_objects_v2(Bucket=self.bucket_name)
            return [obj['Key'] for obj in response.get('Contents', [])]
        except Exception as e:
            print(f"Error listing files in R2: {e}")
            return []
