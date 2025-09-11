import os
import time
import json
import logging
from openai import AzureOpenAI
from dotenv import load_dotenv
from typing import Optional, Dict, Any
import re

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class TLOFGenerator:
    """
    TLOF Generator using fine-tuned Azure OpenAI models.
    Simplified approach without function calling - just natural language to JSON.
    """
    
    def __init__(self):
        """Initialize with Azure OpenAI credentials"""
        load_dotenv()
        
        # Validate environment variables
        required_vars = ["AZURE_OPENAI_API_KEY", "AZURE_OPENAI_ENDPOINT"]
        missing_vars = [var for var in required_vars if not os.getenv(var)]
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {missing_vars}")
        
        self.client = AzureOpenAI(
            api_key=os.getenv("AZURE_OPENAI_API_KEY"),
            api_version="2024-02-01",
            azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
        )
        
        # Model name prioritization: fine-tuned > base model
        self.model_name = (
            os.getenv("AZURE_OPENAI_FINETUNED_MODEL_NAME") or 
            os.getenv("AZURE_OPENAI_MODEL_NAME") or 
            "gpt-3.5-turbo"
        )
        
        self.is_fine_tuned = bool(os.getenv("AZURE_OPENAI_FINETUNED_MODEL_NAME"))
        
        logger.info(f"✅ TLOF Generator initialized")
        logger.info(f"🤖 Using model: {self.model_name}")
        logger.info(f"🔧 Fine-tuned: {'Yes' if self.is_fine_tuned else 'No'}")
    
    def generate_tlof_configuration(self, user_input: str, 
                                  temperature: float = 0.3,
                                  max_tokens: int = 2000) -> Optional[Dict[str, Any]]:
        """
        Generate TLOF configuration from natural language description
        
        Args:
            user_input: Natural language description of TLOF requirements
            temperature: Model temperature (0.0-1.0, lower = more consistent)
            max_tokens: Maximum tokens in response
            
        Returns:
            TLOF configuration dictionary or None if generation failed
        """
        logger.info(f"🚀 Generating TLOF configuration...")
        logger.info(f"📝 Input: {user_input[:100]}...")
        
        try:
            # Prepare messages based on whether we're using fine-tuned model
            if self.is_fine_tuned:
                # Fine-tuned model: simpler system prompt since it's trained on our data
                messages = [
                    {
                        "role": "system",
                        "content": "You are a TLOF configuration generator. Generate valid JSON for TLOF specifications based on natural language descriptions."
                    },
                    {
                        "role": "user",
                        "content": user_input
                    }
                ]
            else:
                # Base model: detailed system prompt with examples
                system_prompt = self._get_enhanced_system_prompt()
                messages = [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": user_input
                    }
                ]
            
            # Generate response
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            response_content = response.choices[0].message.content
            logger.info(f"✅ Generated response ({len(response_content)} characters)")
            
            # Parse and validate JSON
            tlof_config = self._extract_and_validate_json(response_content)
            
            if tlof_config:
                logger.info("🎉 Successfully generated valid TLOF configuration!")
                return tlof_config
            else:
                logger.error("❌ Failed to extract valid JSON from response")
                return None
                
        except Exception as e:
            logger.error(f"💥 Error generating TLOF configuration: {str(e)}")
            return None
    
    def _get_enhanced_system_prompt(self) -> str:
        """Get enhanced system prompt for base models (non-fine-tuned)"""
        return """You are a specialized TLOF (Touchdown and Lift-Off Area) configuration generator for aviation landing surfaces. Generate valid JSON configurations based on natural language descriptions.

REQUIRED JSON STRUCTURE:
{
  "TLOF": [
    {
      "position": [longitude, latitude],
      "dimensions": {
        "unit": "m",
        "aircraftCategory": false,
        "aircraft": "aircraft_type",
        "diameter": number,
        "isVisible": true,
        "layerName": "Generated_TLOF",
        "shapeType": "Rectangle|Circle|Polygon",
        "scaleCategory": false,
        "textureScaleU": 1,
        "textureScaleV": 1,
        "safetyNetScaleU": 1,
        "safetyNetScaleV": 1,
        "sides": number,
        "width": number,
        "length": number,
        "height": number,
        "rotation": number,
        "transparency": number,
        "baseHeight": number,
        "markingsCategory": boolean,
        "markingType": "solid|dashed",
        "markingColor": "white|yellow|blue|red|green|black|purple|orange|gray|brown",
        "markingThickness": number,
        "dashDistance": number,
        "dashLength": number,
        "landingMarkerCategory": boolean,
        "landingMarker": "H|V",
        "markerScale": number,
        "markerThickness": number,
        "markerRotation": number,
        "markerColor": "white|yellow|blue|red|green|black|purple|orange|gray|brown",
        "letterThickness": number,
        "tdpcCategory": boolean,
        "tdpcType": "circle|cross|square",
        "tdpcScale": number,
        "tdpcThickness": number,
        "tdpcRotation": number,
        "tdpcExtrusion": number,
        "tdpcColor": "white|yellow|blue|red|green|black|purple|orange|gray|brown",
        "lightCategory": boolean,
        "lightColor": "white|yellow|blue|red|green|black|purple|orange|gray|brown",
        "lightScale": number,
        "lightDistance": number,
        "lightRadius": number,
        "lightHeight": number,
        "safetyAreaCategory": boolean,
        "safetyAreaType": "offset|multiplier",
        "dValue": number,
        "multiplier": number,
        "offsetDistance": number,
        "safetyNetCategory": boolean,
        "curveAngle": number,
        "netHeight": number,
        "safetyNetTransparency": number,
        "safetyNetColor": "#FF0000"
      }
    }
  ]
}

EXAMPLE:
Input: "rectangular TLOF for helicopter, 30x40m, elevation 5m, blue H marker"
Output: {"TLOF":[{"position":[0,0],"dimensions":{"unit":"m","aircraftCategory":false,"aircraft":"helicopter","shapeType":"Rectangle","width":30,"length":40,"baseHeight":5,"landingMarkerCategory":true,"landingMarker":"H","markerColor":"blue"}}]}

Always respond with valid JSON only. Do not include explanations or markdown formatting."""

    def _extract_and_validate_json(self, response_content: str) -> Optional[Dict[str, Any]]:
        """
        Extract and validate JSON from model response
        
        Args:
            response_content: Raw response from the model
            
        Returns:
            Parsed JSON dict or None if invalid
        """
        # Try direct JSON parsing first
        try:
            tlof_config = json.loads(response_content)
            if self._validate_tlof_structure(tlof_config):
                return tlof_config
        except json.JSONDecodeError:
            pass
        
        # Try to extract JSON from response (handle markdown, etc.)
        json_patterns = [
            r'\{.*\}',  # Simple brace matching
            r'```json\s*(\{.*\})\s*```',  # Markdown code blocks
            r'```\s*(\{.*\})\s*```',  # Generic code blocks
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, response_content, re.DOTALL)
            for match in matches:
                try:
                    tlof_config = json.loads(match)
                    if self._validate_tlof_structure(tlof_config):
                        return tlof_config
                except json.JSONDecodeError:
                    continue
        
        logger.warning("⚠️  Could not extract valid JSON from response")
        logger.debug(f"Response content: {response_content[:500]}...")
        return None
    
    def _validate_tlof_structure(self, config: Dict[str, Any]) -> bool:
        """
        Validate basic TLOF JSON structure
        
        Args:
            config: Parsed JSON configuration
            
        Returns:
            True if structure is valid
        """
        try:
            # Check top-level structure
            if "TLOF" not in config:
                return False
            
            if not isinstance(config["TLOF"], list) or len(config["TLOF"]) == 0:
                return False
            
            # Check first TLOF entry
            tlof = config["TLOF"][0]
            
            required_keys = ["position", "dimensions"]
            for key in required_keys:
                if key not in tlof:
                    return False
            
            # Validate position
            if not isinstance(tlof["position"], list) or len(tlof["position"]) != 2:
                return False
            
            # Validate dimensions is a dict
            if not isinstance(tlof["dimensions"], dict):
                return False
            
            logger.info("✅ TLOF structure validation passed")
            return True
            
        except Exception as e:
            logger.warning(f"⚠️  Structure validation failed: {str(e)}")
            return False
    
    def save_configuration(self, config: Dict[str, Any], filename: Optional[str] = None) -> str:
        """
        Save TLOF configuration to file
        
        Args:
            config: TLOF configuration dictionary
            filename: Optional custom filename
            
        Returns:
            Path to saved file
        """
        if filename is None:
            timestamp = int(time.time())
            filename = f"tlof_config_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"💾 Configuration saved to: {filename}")
        return filename
    
    def batch_generate(self, inputs: list, output_dir: str = "batch_outputs") -> Dict[str, Any]:
        """
        Generate multiple TLOF configurations in batch
        
        Args:
            inputs: List of natural language descriptions
            output_dir: Directory to save batch outputs
            
        Returns:
            Summary of batch generation results
        """
        logger.info(f"📦 Starting batch generation for {len(inputs)} inputs...")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        results = {
            "total": len(inputs),
            "successful": 0,
            "failed": 0,
            "outputs": []
        }
        
        for i, user_input in enumerate(inputs, 1):
            logger.info(f"🔄 Processing {i}/{len(inputs)}: {user_input[:50]}...")
            
            config = self.generate_tlof_configuration(user_input)
            
            if config:
                # Save individual config
                filename = os.path.join(output_dir, f"tlof_config_{i:03d}.json")
                self.save_configuration(config, filename)
                
                results["successful"] += 1
                results["outputs"].append({
                    "index": i,
                    "input": user_input,
                    "output_file": filename,
                    "success": True
                })
            else:
                results["failed"] += 1
                results["outputs"].append({
                    "index": i,
                    "input": user_input,
                    "output_file": None,
                    "success": False
                })
        
        # Save batch summary
        summary_file = os.path.join(output_dir, "batch_summary.json")
        with open(summary_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        logger.info(f"📊 Batch generation completed:")
        logger.info(f"   Successful: {results['successful']}")
        logger.info(f"   Failed: {results['failed']}")
        logger.info(f"   Summary saved to: {summary_file}")
        
        return results

def main():
    """
    Interactive TLOF generator - simplified version of the original notebook
    """
    print("🚀 TLOF Configuration Generator")
    print("=" * 50)
    print("Using Azure OpenAI Fine-tuned Models")
    print()
    
    try:
        # Initialize generator
        generator = TLOFGenerator()
        
        while True:
            print("\n" + "="*50)
            print("TLOF GENERATOR - Choose an option:")
            print("1. Generate single TLOF configuration")
            print("2. Batch generate from file")
            print("3. Test with sample prompts")
            print("4. Exit")
            print("="*50)
            
            choice = input("Enter your choice (1-4): ").strip()
            
            if choice == "1":
                # Single generation
                print("\n📝 Describe your TLOF requirements in natural language:")
                print("Example: 'rectangular TLOF for helicopter, 25x30m, elevation 10m, blue H marker'")
                
                user_input = input("\nTLOF Description: ").strip()
                
                if user_input:
                    print(f"\n🤖 Using model: {generator.model_name}")
                    print("🔄 Generating configuration...")
                    
                    config = generator.generate_tlof_configuration(user_input)
                    
                    if config:
                        print("\n✅ Generated TLOF Configuration:")
                        print(json.dumps(config, indent=2))
                        
                        # Save option
                        save = input("\n💾 Save to file? (y/N): ").strip().lower()
                        if save == 'y':
                            filename = generator.save_configuration(config)
                            print(f"Saved to: {filename}")
                    else:
                        print("❌ Failed to generate configuration. Please try again with a different description.")
                else:
                    print("⚠️  Please provide a description.")
            
            elif choice == "2":
                # Batch generation
                file_path = input("Enter path to file with TLOF descriptions (one per line): ").strip()
                
                if os.path.exists(file_path):
                    try:
                        with open(file_path, 'r') as f:
                            inputs = [line.strip() for line in f if line.strip()]
                        
                        if inputs:
                            print(f"📦 Found {len(inputs)} descriptions to process...")
                            results = generator.batch_generate(inputs)
                            print(f"✅ Batch generation completed! Check 'batch_outputs' directory.")
                        else:
                            print("⚠️  File is empty or contains no valid descriptions.")
                    except Exception as e:
                        print(f"❌ Error reading file: {str(e)}")
                else:
                    print("❌ File not found.")
            
            elif choice == "3":
                # Test with samples
                print("\n🧪 Testing with sample prompts...")
                
                test_prompts = [
                    "Generate a rectangular TLOF for a helicopter with 25m x 30m dimensions, elevation 10m, and blue 'H' landing marker.",
                    "Create a circular landing pad for an eVTOL with 20m diameter, white perimeter lighting, and safety area.",
                    "Design a polygon TLOF for a tiltrotor aircraft with 6 sides, 35m width, red 'V' marker, and dashed markings.",
                    "Build a simple rectangular TLOF for a drone with 8m x 8m dimensions at ground level."
                ]
                
                for i, prompt in enumerate(test_prompts, 1):
                    print(f"\n📝 Test {i}: {prompt}")
                    config = generator.generate_tlof_configuration(prompt)
                    
                    if config:
                        print(f"✅ Test {i}: SUCCESS")
                        # Show basic info
                        tlof = config["TLOF"][0]["dimensions"]
                        print(f"   Aircraft: {tlof.get('aircraft', 'unknown')}")
                        print(f"   Shape: {tlof.get('shapeType', 'unknown')}")
                        print(f"   Size: {tlof.get('width', '?')}x{tlof.get('length', '?')}m")
                    else:
                        print(f"❌ Test {i}: FAILED")
                
                print("\n🏁 Sample testing completed!")
            
            elif choice == "4":
                print("👋 Goodbye!")
                break
            
            else:
                print("⚠️  Invalid choice. Please enter 1-4.")
    
    except KeyboardInterrupt:
        print("\n🛑 Process interrupted by user")
    except Exception as e:
        logger.error(f"💥 Unexpected error: {str(e)}")
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    main() 