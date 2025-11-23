from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
from torchvision import transforms
from torchvision.models import convnext_small, ConvNeXt_Small_Weights
from PIL import Image
import json
import io
import os

MODEL_PATH = "final_V3_Simplified_Two_Phase_best_model.pt"
VENOM_JSON_PATH = "snake_db.json"
NUM_CLASSES = 41
IMG_SIZE = 224

CLASS_NAMES = [
    'Banded Kukri Snake', 'Barred Wolf Snake', 'Beaked Sea Snake', 
    'Black-Headed Snake', 'Blossom Krait', "Boie's Rough-sided Snake", 
    "Boulenger's Bronzeback", "Boulenger's Keelback", 'Brahminy Blindsnake', 
    'Buff Striped Keelback', 'Ceylon Krait', 'Ceylon Wolf Snake', 
    'Ceylonese Cylinder Snake', 'Cobra', 'Common Bronzeback Tree Snake', 
    'Common Krait', 'Common Rough-sided Snake', "Dumaril's Kukri Snake", 
    "Forsten's Cat Snake", 'Golden Tree Snake', 'Green Keelback', 
    'Hypnale Hypnale', 'Indian Wolf Snake', 'Long-nosed Whipsnake', 
    'Lowland Hump-nosed Viper', 'Oriental Rat Snake', "Ranawana's Cat Snake", 
    'Rock Python', 'Russel-s Viper', "Russell's Wolf Snake", 
    "Schokar's Bronzeback", 'Sinharaja Tree Snake', 'Slender Coralsnake', 
    'Spectacled Cobra', 'Sri Lankan Cat Snake', 'Sri Lankan Flying Snake', 
    'Sri Lankan Green Pit Viper', 'Sri Lankan Keelback', 'Sri Lankan Krait', 
    'Sri Lankan Pipe Snake', 'Trinket Snake'
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def load_model():
    try:
        weights = ConvNeXt_Small_Weights.DEFAULT
        model = convnext_small(weights=weights)
        model.classifier[2] = nn.Linear(in_features=768, out_features=NUM_CLASSES)
        state_dict = torch.load(MODEL_PATH, map_location=device)
        model.load_state_dict(state_dict)
        model.to(device)
        model.eval()
        return model
    except Exception as e:
        print(f"Error loading model: {e}")
        raise e

def load_venom_data():
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        json_path = os.path.join(current_dir, VENOM_JSON_PATH)
        
        with open(json_path, "r") as f:
            data = json.load(f)
        
            
        return data
    except Exception as e:
        print(f"Error loading JSON DB: {e}")
        return {}

model = load_model()
venom_data = load_venom_data()

transform = transforms.Compose([
    transforms.Resize((IMG_SIZE, IMG_SIZE)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

@app.get("/")
def home():
    return {"message": "Python Eye API is running"}

@app.post("/predict")
async def predict_snake(file: UploadFile = File(...)):
    try:
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data)).convert('RGB')
        
        img_tensor = transform(image).unsqueeze(0).to(device)
        
        with torch.no_grad():
            outputs = model(img_tensor)
            probabilities = torch.nn.functional.softmax(outputs, dim=1)
            
        top5_prob, top5_idx = torch.topk(probabilities, 5)
        
        predictions = []
        for i in range(5):
            confidence = top5_prob[0][i].item()
            class_idx = top5_idx[0][i].item()
            name = CLASS_NAMES[class_idx].strip()
            
            # Safe lookup. Defaults to Unknown/None if keys are missing
            info = venom_data.get(name, {})
            scientific = info.get("scientific", "Unknown")
            venom = info.get("venom", "Unknown")
            description = info.get("description", None) 
            
            predictions.append({
                "species": name,
                "scientific_name": scientific,
                "venom_status": venom,
                "description": description,
                "confidence": f"{confidence*100:.2f}%"
            })

        return {
            "main": predictions[0],
            "others": predictions[1:] 
        }

    except Exception as e:
        print(f"Error during prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))