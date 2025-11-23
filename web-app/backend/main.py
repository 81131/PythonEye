from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import torch
import torch.nn as nn
from torchvision import transforms
from torchvision.models import convnext_small, ConvNeXt_Small_Weights
from PIL import Image
import pandas as pd
import io

# --- Configuration ---
MODEL_PATH = "final_V3_Simplified_Two_Phase_best_model.pt"
VENOM_CSV_PATH = "Snake_Names_And_Venom.csv"
NUM_CLASSES = 41
IMG_SIZE = 224

# Same class list as your app.py
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

# Allow the frontend to talk to this backend (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only. In production, set to your frontend domain.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Load Model & Data (Runs once at startup) ---
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

def load_model():
    print("Loading model...")
    weights = ConvNeXt_Small_Weights.DEFAULT
    model = convnext_small(weights=weights)
    # Replicate the modification from your app.py
    model.classifier[2] = nn.Linear(in_features=768, out_features=NUM_CLASSES)
    
    # Load state dict (map_location handles CPU/GPU automatically)
    state_dict = torch.load(MODEL_PATH, map_location=device)
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    return model

def load_venom_data():
    try:
        df = pd.read_csv(VENOM_CSV_PATH)
        # Strip whitespace from names to ensure matches
        df['Snake_Name'] = df['Snake_Name'].str.strip()
        df['Venom_Status'] = df['Venom_Status'].str.strip()
        
        # Create dictionary
        return pd.Series(df.Venom_Status.values, index=df.Snake_Name).to_dict()
    except Exception as e:
        print(f"Warning: Could not load CSV. {e}")
        return {}

# Global variables
model = load_model()
venom_data = load_venom_data()

# Define Transforms
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
            
        top_prob, top_idx = torch.max(probabilities, 1)
        confidence = top_prob.item()
        class_idx = top_idx.item()
        
        predicted_name = CLASS_NAMES[class_idx].strip() # Strip whitespace from model output
        
        # Safe Lookup: usage of .get() prevents the KeyError crash
        venom_status = venom_data.get(predicted_name, "Unknown")
        
        return {
            "species": predicted_name,
            "venom_status": venom_status,
            "confidence": f"{confidence*100:.2f}%"
        }

    except Exception as e:
        print(f"Error during prediction: {e}") # Print error to terminal
        raise HTTPException(status_code=500, detail=str(e))