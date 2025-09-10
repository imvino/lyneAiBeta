import os
import time
import json
import logging
from openai import AzureOpenAI
from dotenv import load_dotenv
from typing import Optional, Dict, Any, List

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AzureFineTuner:
    """
    Comprehensive Azure OpenAI fine-tuning manager for TLOF models.
    Handles the complete workflow from data upload to model deployment.
    """
    
    def __init__(self):
        """Initialize Azure OpenAI client with environment variables"""
        load_dotenv()
        
        # Validate environment variables
        required_vars = [
            "AZURE_OPENAI_API_KEY",
            "AZURE_OPENAI_ENDPOINT"
        ]
        
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")
        
        self.client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version="2024-02-01",  # Latest API version for fine-tuning
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
        )
        
        logger.info("✅ Azure OpenAI client initialized successfully")
    
    def upload_training_file(self, file_path: str) -> str:
        """
        Upload training data file to Azure OpenAI
        
        Args:
            file_path: Path to the JSONL training file
            
        Returns:
            File ID for the uploaded file
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Training file not found: {file_path}")
        
        # Validate file size (Azure has limits)
        file_size = os.path.getsize(file_path)
        max_size = 100 * 1024 * 1024  # 100MB limit
        
        if file_size > max_size:
            raise ValueError(f"File too large: {file_size/1024/1024:.1f}MB (max: 100MB)")
        
        logger.info(f"📤 Uploading training file: {file_path} ({file_size/1024/1024:.1f}MB)")
        
        try:
            with open(file_path, 'rb') as f:
                response = self.client.files.create(
                    file=f,
                    purpose="fine-tune"
                )
            
            logger.info(f"✅ File uploaded successfully. File ID: {response.id}")
            return response.id
            
        except Exception as e:
            logger.error(f"❌ Failed to upload file: {str(e)}")
            raise
    
    def list_uploaded_files(self) -> List[Dict]:
        """List all uploaded files for fine-tuning"""
        try:
            files = self.client.files.list(purpose="fine-tune")
            return [{"id": f.id, "filename": f.filename, "created": f.created_at} for f in files.data]
        except Exception as e:
            logger.error(f"❌ Failed to list files: {str(e)}")
            return []
    
    def create_fine_tuning_job(self, training_file_id: str, 
                              base_model: str = "gpt-3.5-turbo",
                              validation_file_id: Optional[str] = None,
                              hyperparameters: Optional[Dict] = None) -> str:
        """
        Create a fine-tuning job with advanced configuration
        
        Args:
            training_file_id: ID of uploaded training file
            base_model: Base model to fine-tune
            validation_file_id: Optional validation file ID
            hyperparameters: Custom hyperparameters
            
        Returns:
            Fine-tuning job ID
        """
        if hyperparameters is None:
            hyperparameters = {
                "n_epochs": 3,  # Number of training epochs
                "batch_size": 1,  # Batch size (1-256)
                "learning_rate_multiplier": 0.1  # Learning rate multiplier
            }
        
        logger.info(f"🚀 Creating fine-tuning job with base model: {base_model}")
        logger.info(f"📊 Hyperparameters: {hyperparameters}")
        
        try:
            job_params = {
                "training_file": training_file_id,
                "model": base_model,
                "hyperparameters": hyperparameters
            }
            
            # Add validation file if provided
            if validation_file_id:
                job_params["validation_file"] = validation_file_id
                logger.info(f"📋 Using validation file: {validation_file_id}")
            
            response = self.client.fine_tuning.jobs.create(**job_params)
            
            logger.info(f"✅ Fine-tuning job created successfully!")
            logger.info(f"📝 Job ID: {response.id}")
            logger.info(f"📊 Status: {response.status}")
            
            return response.id
            
        except Exception as e:
            logger.error(f"❌ Failed to create fine-tuning job: {str(e)}")
            raise
    
    def monitor_fine_tuning(self, job_id: str, check_interval: int = 60) -> Optional[str]:
        """
        Monitor fine-tuning job progress with detailed status updates
        
        Args:
            job_id: Fine-tuning job ID
            check_interval: How often to check status (seconds)
            
        Returns:
            Fine-tuned model name if successful, None if failed
        """
        logger.info(f"👀 Monitoring fine-tuning job: {job_id}")
        logger.info(f"⏱️  Checking every {check_interval} seconds...")
        
        start_time = time.time()
        last_status = None
        
        while True:
            try:
                job = self.client.fine_tuning.jobs.retrieve(job_id)
                status = job.status
                
                # Log status changes
                if status != last_status:
                    elapsed = time.time() - start_time
                    logger.info(f"📊 Status: {status} (Elapsed: {elapsed/60:.1f} minutes)")
                    last_status = status
                
                # Check for completion
                if status == "succeeded":
                    elapsed = time.time() - start_time
                    logger.info(f"🎉 Fine-tuning completed successfully!")
                    logger.info(f"⏱️  Total time: {elapsed/60:.1f} minutes")
                    logger.info(f"🤖 Fine-tuned model: {job.fine_tuned_model}")
                    
                    # Log training metrics if available
                    if hasattr(job, 'result_files') and job.result_files:
                        logger.info("📈 Training completed with metrics available")
                    
                    return job.fine_tuned_model
                
                elif status == "failed":
                    logger.error(f"❌ Fine-tuning failed!")
                    if hasattr(job, 'error') and job.error:
                        logger.error(f"💥 Error details: {job.error}")
                    return None
                
                elif status in ["cancelled", "validating_files"]:
                    logger.warning(f"⚠️  Job status: {status}")
                    return None
                
                # Wait before next check
                time.sleep(check_interval)
                
            except KeyboardInterrupt:
                logger.info("🛑 Monitoring interrupted by user")
                return None
            except Exception as e:
                logger.error(f"❌ Error monitoring job: {str(e)}")
                time.sleep(check_interval)
    
    def list_fine_tuning_jobs(self, limit: int = 10) -> List[Dict]:
        """List recent fine-tuning jobs"""
        try:
            jobs = self.client.fine_tuning.jobs.list(limit=limit)
            return [{
                "id": job.id,
                "model": job.model,
                "status": job.status,
                "created_at": job.created_at,
                "fine_tuned_model": getattr(job, 'fine_tuned_model', None)
            } for job in jobs.data]
        except Exception as e:
            logger.error(f"❌ Failed to list jobs: {str(e)}")
            return []
    
    def test_fine_tuned_model(self, model_name: str, test_prompts: List[str]) -> List[Dict]:
        """
        Test the fine-tuned model with sample prompts
        
        Args:
            model_name: Name of the fine-tuned model
            test_prompts: List of test prompts
            
        Returns:
            List of test results
        """
        logger.info(f"🧪 Testing fine-tuned model: {model_name}")
        results = []
        
        for i, prompt in enumerate(test_prompts, 1):
            logger.info(f"📝 Test {i}/{len(test_prompts)}: {prompt[:50]}...")
            
            try:
                response = self.client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "You are a TLOF configuration generator. Generate valid JSON for TLOF specifications based on natural language descriptions."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=2000,
                    temperature=0.3
                )
                
                result = {
                    "prompt": prompt,
                    "response": response.choices[0].message.content,
                    "success": True
                }
                
                # Try to validate JSON response
                try:
                    json.loads(result["response"])
                    result["valid_json"] = True
                except json.JSONDecodeError:
                    result["valid_json"] = False
                    logger.warning(f"⚠️  Test {i} produced invalid JSON")
                
                results.append(result)
                logger.info(f"✅ Test {i} completed")
                
            except Exception as e:
                logger.error(f"❌ Test {i} failed: {str(e)}")
                results.append({
                    "prompt": prompt,
                    "response": f"Error: {str(e)}",
                    "success": False,
                    "valid_json": False
                })
        
        # Summary
        successful_tests = sum(1 for r in results if r["success"])
        valid_json_tests = sum(1 for r in results if r.get("valid_json", False))
        
        logger.info(f"📊 Test Results Summary:")
        logger.info(f"   Successful responses: {successful_tests}/{len(test_prompts)}")
        logger.info(f"   Valid JSON responses: {valid_json_tests}/{len(test_prompts)}")
        
        return results
    
    def delete_fine_tuning_files(self, file_ids: List[str]) -> None:
        """Clean up uploaded files"""
        for file_id in file_ids:
            try:
                self.client.files.delete(file_id)
                logger.info(f"🗑️  Deleted file: {file_id}")
            except Exception as e:
                logger.warning(f"⚠️  Failed to delete file {file_id}: {str(e)}")

def main():
    """
    Main fine-tuning workflow
    """
    print("🚀 Azure OpenAI Fine-tuning for TLOF Models")
    print("=" * 60)
    
    try:
        # Initialize fine-tuner
        tuner = AzureFineTuner()
        
        # Configuration
        training_file = "tlof_training_data.jsonl"
        validation_file = "tlof_validation_data.jsonl"
        base_model = "gpt-3.5-turbo"  # Use gpt-4 if available in your region
        
        # Check if training files exist
        if not os.path.exists(training_file):
            logger.error(f"❌ Training file not found: {training_file}")
            logger.info("🔧 Please run 'python training_data_generator.py' first!")
            return
        
        # Step 1: Upload training file
        logger.info("📤 Step 1: Uploading training data...")
        training_file_id = tuner.upload_training_file(training_file)
        
        # Step 2: Upload validation file (optional)
        validation_file_id = None
        if os.path.exists(validation_file):
            logger.info("📤 Step 2: Uploading validation data...")
            validation_file_id = tuner.upload_training_file(validation_file)
        else:
            logger.warning("⚠️  No validation file found, proceeding without validation")
        
        # Step 3: Create fine-tuning job with custom hyperparameters
        logger.info("🚀 Step 3: Creating fine-tuning job...")
        
        # Advanced hyperparameters for better results
        hyperparameters = {
            "n_epochs": 3,  # More epochs for better learning
            "batch_size": 1,  # Small batch size for stability
            "learning_rate_multiplier": 0.1  # Conservative learning rate
        }
        
        job_id = tuner.create_fine_tuning_job(
            training_file_id=training_file_id,
            base_model=base_model,
            validation_file_id=validation_file_id,
            hyperparameters=hyperparameters
        )
        
        # Step 4: Monitor progress
        logger.info("👀 Step 4: Monitoring training progress...")
        fine_tuned_model = tuner.monitor_fine_tuning(job_id, check_interval=60)
        
        if fine_tuned_model:
            # Step 5: Test the model
            logger.info("🧪 Step 5: Testing fine-tuned model...")
            
            test_prompts = [
                "Generate a rectangular TLOF for a helicopter with 25m x 30m dimensions, elevation 10m, and blue 'H' landing marker.",
                "Create a circular landing pad for an eVTOL with 20m diameter, white perimeter lighting, and safety area.",
                "Design a polygon TLOF for a tiltrotor aircraft with 6 sides, 35m width, red 'V' marker, and dashed markings.",
                "Build a simple rectangular TLOF for a drone with 8m x 8m dimensions at ground level."
            ]
            
            test_results = tuner.test_fine_tuned_model(fine_tuned_model, test_prompts)
            
            # Step 6: Save results and cleanup
            logger.info("💾 Step 6: Saving results...")
            
            # Save test results
            with open("fine_tuning_results.json", "w") as f:
                json.dump({
                    "model_name": fine_tuned_model,
                    "job_id": job_id,
                    "base_model": base_model,
                    "hyperparameters": hyperparameters,
                    "test_results": test_results,
                    "timestamp": time.time()
                }, f, indent=2)
            
            # Success message
            print("\n" + "=" * 60)
            print("🎉 FINE-TUNING COMPLETED SUCCESSFULLY!")
            print("=" * 60)
            print(f"📝 Your fine-tuned model: {fine_tuned_model}")
            print(f"📊 Job ID: {job_id}")
            print(f"📋 Results saved to: fine_tuning_results.json")
            print("\n🔧 To use this model in your application:")
            print(f"   Set AZURE_OPENAI_FINETUNED_MODEL_NAME={fine_tuned_model}")
            print(f"   Use 'python updated_tlof_model.py' to test it")
            print("\n✨ Your model is now ready for production use!")
            
            # Optional cleanup
            cleanup = input("\n🗑️  Delete uploaded training files? (y/N): ").strip().lower()
            if cleanup == 'y':
                files_to_delete = [training_file_id]
                if validation_file_id:
                    files_to_delete.append(validation_file_id)
                tuner.delete_fine_tuning_files(files_to_delete)
        
        else:
            logger.error("❌ Fine-tuning failed. Check the logs above for details.")
    
    except KeyboardInterrupt:
        logger.info("🛑 Process interrupted by user")
    except Exception as e:
        logger.error(f"💥 Unexpected error: {str(e)}")
        raise

if __name__ == "__main__":
    main() 