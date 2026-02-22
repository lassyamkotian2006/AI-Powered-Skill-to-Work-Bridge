import logging
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from dotenv import load_dotenv

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# HuggingFace Configuration
HF_API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-large"
HF_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

def query_huggingface(prompt):
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_length": 1000,
            "temperature": 0.7,
            "top_p": 0.9
        }
    }
    response = requests.post(HF_API_URL, headers=headers, json=payload)
    return response.json()

@app.route('/generate-learning-path', methods=['POST'])
def generate_learning_path():
    data = request.json
    skills = data.get('skills', [])
    interest = data.get('interest', '')
    target_role = data.get('target_role', '')

    logger.info(f"🚀 Generating learning path for {target_role} with {len(skills)} skills")

    if not skills or not interest or not target_role:
        return jsonify({"error": "Missing required data"}), 400

    prompt = f"""
    User Current Skills: {', '.join([s['name'] for s in skills])}
    User Interest: {interest}
    Target Job Role: {target_role}

    Suggest a complete step-by-step learning path to become a highly qualified {target_role}.
    Include:
    * Missing skills to learn
    * Technologies to learn
    * Tools and frameworks
    * Beginner to advanced roadmap
    * Correct order of learning

    Return the result as a structured list with clear section headers.
    """

    try:
        hf_response = query_huggingface(prompt)
        
        # flan-t5-large returns a list of dicts
        if isinstance(hf_response, list) and len(hf_response) > 0:
            generated_text = hf_response[0].get('generated_text', '')
        else:
            generated_text = str(hf_response)

        # Basic skill match calculation (heuristic)
        # In a real app, this would be more sophisticated
        match_percentage = calculate_match_percentage(skills, target_role)

        return jsonify({
            "success": True,
            "learning_path": generated_text,
            "match_percentage": match_percentage,
            "target_role": target_role
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

def calculate_match_percentage(user_skills, target_role):
    # Simple heuristic: basic skill matching
    # This is a placeholder for a more complex matching logic
    # that could compare against a vector db or fixed requirements
    relevant_keywords = {
        "Backend Developer": ["node.js", "python", "sql", "api", "database", "git"],
        "Frontend Developer": ["javascript", "react", "html", "css", "figma", "git"],
        "AI Engineer": ["python", "machine learning", "pytorch", "tensorflow", "data analysis"],
        "UI/UX Designer": ["figma", "design", "user research", "prototyping"]
    }
    
    keywords = relevant_keywords.get(target_role, ["git", "api"])
    user_skill_names = [s['name'].lower() for s in user_skills]
    
    matches = [k for k in keywords if any(k in us for us in user_skill_names)]
    percentage = int((len(matches) / len(keywords)) * 100) if keywords else 0
    return min(max(percentage, 10), 95) # Keep between 10% and 95% for demo

if __name__ == '__main__':
    app.run(port=5001, debug=True)
