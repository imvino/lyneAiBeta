# TLOF Model Training on Azure Cloud 🚀

Complete guide for training high-quality TLOF (Touchdown and Lift-Off Area) models using Azure OpenAI fine-tuning. Transform your complex function calling into simple natural language → JSON conversion.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Azure Setup](#azure-setup)
4. [Environment Setup](#environment-setup)
5. [Training Data Generation](#training-data-generation)
6. [Fine-tuning Process](#fine-tuning-process)
7. [Using Your Trained Model](#using-your-trained-model)
8. [Quality Assurance](#quality-assurance)
9. [Cost Optimization](#cost-optimization)
10. [Troubleshooting](#troubleshooting)

## 🎯 Overview

This training system converts your current complex TLOF function calling approach into a streamlined fine-tuned model that:

- **Eliminates 200+ lines of function definitions**
- **Converts natural language directly to valid JSON**
- **Provides consistent, high-quality outputs**
- **Reduces API complexity and latency**

### Before vs After

**Before (Function Calling):**
```python
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": user_input}],
    functions=function_def,  # 200+ lines of complex function definitions
    function_call={"name": "generate_landing_surface_layout"}
)
```

**After (Fine-tuned Model):**
```python
response = client.chat.completions.create(
    model="your-fine-tuned-model",
    messages=[
        {"role": "system", "content": "Generate TLOF JSON."},
        {"role": "user", "content": user_input}
    ]
)
# Direct JSON response - no function parsing needed!
```

## 🔧 Prerequisites

### Azure Requirements
- **Azure subscription** (free tier works!)
- **Azure OpenAI resource** with fine-tuning enabled
- **Models available:** GPT-3.5-turbo or GPT-4

### Local Requirements
- **Python 3.8+**
- **10GB free disk space** (for training data)
- **Stable internet connection**

## ☁️ Azure Setup

### Step 1: Create Azure OpenAI Resource

1. **Log into Azure Portal**
   ```
   https://portal.azure.com
   ```

2. **Create Azure OpenAI Service**
   - Search for "Azure OpenAI"
   - Click "Create"
   - Choose subscription and resource group
   - Select region (use regions with fine-tuning support):
     - East US
     - South Central US
     - West Europe
   - Choose pricing tier: Standard S0

3. **Deploy Base Model**
   - Go to Azure OpenAI Studio: `https://oai.azure.com`
   - Navigate to "Deployments"
   - Deploy `gpt-3.5-turbo` (recommended for cost-effectiveness)
   - Note the deployment name

4. **Get API Credentials**
   - Go to "Keys and Endpoint" in your Azure OpenAI resource
   - Copy:
     - API Key
     - Endpoint URL
     - Model name

### Step 2: Enable Fine-tuning (If Needed)

Some regions may require requesting access to fine-tuning:

1. **Check Fine-tuning Availability**
   - In Azure OpenAI Studio, look for "Fine-tuning" tab
   - If not available, submit a request through Azure support

2. **Request Quota Increase (If Needed)**
   - Default fine-tuning quota may be limited
   - Submit quota increase request if you plan to train multiple models

## 🛠️ Environment Setup

### Step 1: Clone/Download Files

If not already done, ensure you have these files in your `tlof_model_training` directory:
- `training_data_generator.py`
- `azure_finetune.py`
- `updated_tlof_model.py`
- `requirements.txt`
- `README.md` (this file)

### Step 2: Install Dependencies

```bash
# Navigate to training directory
cd tlof_model_training

# Install required packages
pip install -r requirements.txt
```

### Step 3: Configure Environment Variables

Create a `.env` file in the `tlof_model_training` directory:

```bash
# .env file
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com/
AZURE_OPENAI_MODEL_NAME=gpt-3.5-turbo

# After fine-tuning, add this:
# AZURE_OPENAI_FINETUNED_MODEL_NAME=your-fine-tuned-model-name
```

**⚠️ Security Note:** Never commit the `.env` file to version control!

### Step 4: Test Azure Connection

```bash
python -c "
import os
from dotenv import load_dotenv
from openai import AzureOpenAI

load_dotenv()
client = AzureOpenAI(
    api_key=os.getenv('AZURE_OPENAI_API_KEY'),
    api_version='2024-02-01',
    azure_endpoint=os.getenv('AZURE_OPENAI_ENDPOINT')
)

try:
    response = client.chat.completions.create(
        model=os.getenv('AZURE_OPENAI_MODEL_NAME'),
        messages=[{'role': 'user', 'content': 'Hello'}],
        max_tokens=5
    )
    print('✅ Azure OpenAI connection successful!')
except Exception as e:
    print(f'❌ Connection failed: {e}')
"
```

## 🔄 Training Data Generation

### Step 1: Generate High-Quality Training Data

```bash
python training_data_generator.py
```

**What this does:**
- Generates **3,000 high-quality training examples**
- Creates **600 validation examples**
- Produces realistic, varied natural language descriptions
- Covers all TLOF parameters and configurations
- Validates JSON structure and format

**Output files:**
- `tlof_training_data.jsonl` (2,400 examples)
- `tlof_validation_data.jsonl` (600 examples)

### Step 2: Review Training Data Quality

Check the first few examples to ensure quality:

```bash
# View first 3 training examples
head -3 tlof_training_data.jsonl | python -m json.tool
```

**Expected structure:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Create a rectangular TLOF for helicopter with dimensions 25m x 30m..."
    },
    {
      "role": "assistant", 
      "content": "{\"TLOF\":[{\"position\":[139.6917,35.6895],\"dimensions\":{...}}]}"
    }
  ]
}
```

## 🚀 Fine-tuning Process

### Step 1: Start Fine-tuning

```bash
python azure_finetune.py
```

**Process Overview:**
1. **Upload training files** to Azure OpenAI (~2-5 minutes)
2. **Create fine-tuning job** with optimized hyperparameters
3. **Monitor training progress** (typically 1-3 hours)
4. **Test the trained model** with sample prompts
5. **Save results** and configuration

### Step 2: Monitor Progress

The script will automatically monitor and display:
- ⏱️ **Training status** and elapsed time
- 📊 **Progress updates** every minute
- 🎉 **Completion notification** with model name
- 🧪 **Automatic testing** with sample prompts

### Step 3: Training Completion

When training completes successfully, you'll see:

```
🎉 FINE-TUNING COMPLETED SUCCESSFULLY!
===============================================
📝 Your fine-tuned model: ft:gpt-3.5-turbo:your-org:tlof-model:abc123
📊 Job ID: ftjob-abc123xyz
📋 Results saved to: fine_tuning_results.json

🔧 To use this model in your application:
   Set AZURE_OPENAI_FINETUNED_MODEL_NAME=ft:gpt-3.5-turbo:your-org:tlof-model:abc123
   Use 'python updated_tlof_model.py' to test it

✨ Your model is now ready for production use!
```

### Step 4: Update Environment

Add your fine-tuned model to `.env`:

```bash
AZURE_OPENAI_FINETUNED_MODEL_NAME=ft:gpt-3.5-turbo:your-org:tlof-model:abc123
```

## 🎯 Using Your Trained Model

### Interactive Testing

```bash
python updated_tlof_model.py
```

**Features:**
- 🔧 **Single TLOF generation** with natural language input
- 📦 **Batch processing** from text files
- 🧪 **Built-in test suite** with sample prompts
- 💾 **Automatic saving** of configurations

### Integration into Existing Code

Replace your current function calling approach:

```python
# OLD CODE (Function Calling)
response = client.chat.completions.create(
    model="gpt-3.5-turbo",
    messages=[{"role": "user", "content": user_input}],
    functions=complex_function_definitions,
    function_call={"name": "generate_landing_surface_layout"}
)

# NEW CODE (Fine-tuned Model)
from dotenv import load_dotenv
load_dotenv()

response = client.chat.completions.create(
    model=os.getenv("AZURE_OPENAI_FINETUNED_MODEL_NAME"),
    messages=[
        {"role": "system", "content": "You are a TLOF configuration generator."},
        {"role": "user", "content": user_input}
    ],
    temperature=0.3
)

# Parse JSON directly
tlof_config = json.loads(response.choices[0].message.content)
```

### Batch Processing

Create a text file with TLOF descriptions (one per line):

```text
rectangular TLOF for helicopter, 25x30m, elevation 10m, blue H marker
circular landing pad for eVTOL, 20m diameter, white lighting
polygon TLOF for tiltrotor, 6 sides, 35m width, red V marker
```

Then run batch processing:

```python
from updated_tlof_model import TLOFGenerator

generator = TLOFGenerator()
with open("batch_inputs.txt", "r") as f:
    inputs = [line.strip() for line in f if line.strip()]

results = generator.batch_generate(inputs)
print(f"Generated {results['successful']} configurations")
```

## ✅ Quality Assurance

### Testing Your Model

The training includes comprehensive quality checks:

1. **JSON Validation**
   - Structure correctness
   - Required fields presence
   - Data type validation

2. **Consistency Testing**
   - Same input → same output
   - Parameter range validation
   - Aircraft-appropriate dimensions

3. **Edge Case Handling**
   - Invalid inputs
   - Missing parameters
   - Extreme values

### Performance Metrics

Monitor these metrics for quality:

- **JSON Success Rate:** >95% for fine-tuned models
- **Parameter Accuracy:** Dimensions within realistic ranges
- **Response Time:** <3 seconds per generation
- **Consistency:** Same input produces similar outputs

### Continuous Improvement

To improve your model:

1. **Collect problematic inputs** that produce poor outputs
2. **Add them to training data** with correct outputs
3. **Retrain periodically** with updated datasets
4. **A/B test** fine-tuned vs base model performance

## 💰 Cost Optimization

### Training Costs (One-time)

| Component | Estimated Cost |
|-----------|----------------|
| Training Data Upload | $0.10 |
| Fine-tuning (3K examples) | $15-25 |
| Testing | $1-2 |
| **Total Training** | **$16-27** |

### Usage Costs (Ongoing)

| Model Type | Cost per 1K tokens |
|------------|-------------------|
| GPT-3.5-turbo (base) | $0.0015 |
| GPT-3.5-turbo (fine-tuned) | $0.0020 |
| GPT-4 (base) | $0.03 |
| GPT-4 (fine-tuned) | $0.06 |

**Cost Savings:**
- Fine-tuned models need shorter prompts = lower usage costs
- Fewer API calls due to higher success rates
- Reduced debugging and validation overhead

### Free Tier Usage

With Azure free credits ($200):
- Train **8-12 models** with current dataset size
- Generate **100K+ TLOF configurations**
- Experiment extensively before committing to paid plans

## 🔧 Troubleshooting

### Common Issues

#### 1. "Authentication Failed"
```bash
❌ Error: Authentication failed
```
**Solution:**
- Check API key in `.env` file
- Verify endpoint URL format
- Ensure Azure OpenAI resource is active

#### 2. "Model Not Found"
```bash
❌ Error: Model 'gpt-3.5-turbo' not found
```
**Solution:**
- Deploy the model in Azure OpenAI Studio
- Use exact deployment name in environment variables
- Check region availability

#### 3. "Fine-tuning Quota Exceeded"
```bash
❌ Error: Fine-tuning quota exceeded
```
**Solution:**
- Request quota increase in Azure portal
- Delete old fine-tuning jobs
- Use smaller training datasets

#### 4. "Invalid Training Data Format"
```bash
❌ Error: Invalid training data format
```
**Solution:**
- Re-run `training_data_generator.py`
- Validate JSONL format:
  ```bash
  python -c "
  import json
  with open('tlof_training_data.jsonl') as f:
      for i, line in enumerate(f):
          try:
              json.loads(line)
          except:
              print(f'Invalid JSON on line {i+1}')
  "
  ```

#### 5. "Poor Model Performance"
```bash
⚠️ Model produces invalid JSON frequently
```
**Solution:**
- Increase training epochs (edit `azure_finetune.py`)
- Add more diverse training examples
- Lower temperature (0.1-0.3) for more consistent outputs
- Use validation file to monitor overfitting

### Advanced Debugging

#### Enable Detailed Logging
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

#### Test Individual Components
```bash
# Test training data generation only
python -c "
from training_data_generator import TLOFTrainingDataGenerator
gen = TLOFTrainingDataGenerator()
example = gen.generate_single_example()
print(example)
"

# Test Azure connection only
python -c "
from azure_finetune import AzureFineTuner
tuner = AzureFineTuner()
print('✅ Connection successful')
"
```

### Getting Help

If you encounter issues:

1. **Check Azure Status:** https://status.azure.com/
2. **Review Azure OpenAI Documentation:** https://docs.microsoft.com/azure/cognitive-services/openai/
3. **Monitor Azure costs:** https://portal.azure.com - Cost Management
4. **Submit support tickets** through Azure portal for quota/access issues

## 📈 Scaling and Production

### Multi-Model Strategy

For production applications:

1. **Specialized Models**
   - Train separate models for different aircraft types
   - Create region-specific models for local regulations
   - Develop safety-focused vs speed-focused variants

2. **Model Versioning**
   - Keep track of model versions
   - A/B test new models against production
   - Maintain rollback capabilities

3. **Monitoring and Analytics**
   - Track model performance metrics
   - Monitor cost per generation
   - Collect user feedback for continuous improvement

### Integration with Existing Systems

```python
# Example production integration
class ProductionTLOFService:
    def __init__(self):
        self.generator = TLOFGenerator()
        self.cache = {}  # Add caching for common requests
        self.metrics = {}  # Track usage metrics
    
    async def generate_tlof(self, request):
        # Add validation, caching, error handling
        try:
            config = self.generator.generate_tlof_configuration(request.description)
            self.metrics['successful_generations'] += 1
            return config
        except Exception as e:
            self.metrics['failed_generations'] += 1
            # Fallback to base model or cached response
            return self.fallback_generation(request)
```

## 🎉 Success Metrics

You'll know your training was successful when:

- ✅ **JSON Success Rate:** >95%
- ✅ **Response Consistency:** Similar inputs produce similar outputs
- ✅ **Parameter Accuracy:** Generated dimensions match aircraft requirements
- ✅ **Cost Reduction:** Lower per-generation costs vs function calling
- ✅ **Code Simplification:** Eliminated complex function definitions
- ✅ **User Satisfaction:** More natural language input handling

## 📚 Additional Resources

- **Azure OpenAI Fine-tuning Guide:** https://docs.microsoft.com/azure/cognitive-services/openai/how-to/fine-tuning
- **OpenAI Fine-tuning Best Practices:** https://platform.openai.com/docs/guides/fine-tuning
- **TLOF Regulations:** ICAO Annex 14, FAA AC 150/5390-2C, EASA guidelines
- **JSON Schema Validation:** https://json-schema.org/

---

## 🚀 Quick Start Checklist

- [ ] Azure OpenAI resource created and configured
- [ ] Environment variables set in `.env` file
- [ ] Dependencies installed with `pip install -r requirements.txt`
- [ ] Training data generated with `python training_data_generator.py`
- [ ] Fine-tuning completed with `python azure_finetune.py`
- [ ] Model tested with `python updated_tlof_model.py`
- [ ] Integration into existing codebase completed

**Congratulations!** You now have a high-quality, fine-tuned TLOF model running on Azure! 🎉

Your model is ready for production use and will consistently generate valid TLOF configurations from simple natural language descriptions. 