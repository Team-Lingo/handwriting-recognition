import os
from firebase_functions import https_fn, options
from firebase_admin import initialize_app

initialize_app()

# 1. Global Setup (Keep this extremely lightweight!)
CONFIG = {
    "img_size": (224, 224),
    "device": "cpu", # Must run on CPU in serverless Google Cloud
}

# Create empty global variables to cache the model in memory after the first request
cached_model = None
cached_transforms = None

def initialize_ml_components():
    """
    This function lazy-loads PyTorch only when the endpoint is actually hit.
    It caches the model globally so subsequent requests are fast.
    """
    global cached_model, cached_transforms
    
    # If it's already loaded, skip doing it again!
    if cached_model is not None:
        return

    # Import heavy libraries HERE, completely hidden from Firebase's initial scan
    import torch
    import torch.nn as nn
    from torchvision import transforms, models

    # Setup Transforms
    cached_transforms = transforms.Compose([
        transforms.Resize(CONFIG['img_size']),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    ])

    # Define Model Architecture
    class SiameseTransformer(nn.Module):
        def __init__(self):
            super().__init__()
            eff = models.efficientnet_b0(weights=None)
            self.backbone = eff.features
            self.feature_dim = 1280
            self.pos_embedding = nn.Parameter(torch.randn(1, 49, self.feature_dim))
            layer = nn.TransformerEncoderLayer(d_model=self.feature_dim, nhead=8, batch_first=True)
            self.transformer = nn.TransformerEncoder(layer, num_layers=2)
            
            self.fc = nn.Sequential(
                nn.Linear(self.feature_dim, 256),
                nn.ReLU(),
                nn.Dropout(0.2), 
                nn.Linear(256, 128)
            )

        def forward_one(self, x):
            x = self.backbone(x)
            x = x.view(x.size(0), self.feature_dim, -1).permute(0, 2, 1)
            x = self.transformer(x + self.pos_embedding)
            return self.fc(torch.mean(x, dim=1))

        def forward(self, i1, i2): 
            return self.forward_one(i1), self.forward_one(i2)

    # Load Model Weights
    cached_model = SiameseTransformer().to(CONFIG['device'])
    model_path = os.path.join(os.path.dirname(__file__), "final_signature_model.pth")
    
    if os.path.exists(model_path):
        cached_model.load_state_dict(torch.load(model_path, map_location=CONFIG['device']))
        cached_model.eval()
    else:
        print("Warning: Model weights not found at", model_path)


# 3. Request Handler Endpoint
@https_fn.on_request(memory=options.MemoryOption.GB_2, timeout_sec=60)
def verify_signature(req: https_fn.Request) -> https_fn.Response:
    # 1. Handle CORS instantly (No ML needed yet)
    if req.method == "OPTIONS":
        headers = {
            "Access-Control-Allow-Origin": "*", # instead of "*" specify live production app domain
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "3600"
        }
        return https_fn.Response("", status=204, headers=headers)
        
    if req.method != "POST":
        return https_fn.Response("Method Not Allowed", status=405)
        
    try:
        # 2. Boot up PyTorch (This only takes time on the very first API call)
        initialize_ml_components()
        
        # 3. Import request-specific heavy libraries
        import torch
        import torch.nn.functional as F
        from PIL import Image

        # Extract files from multipart/form-data
        ref_file = req.files.get("reference")
        test_file = req.files.get("test")
        
        if not ref_file or not test_file:
            return https_fn.Response('{"error": "Missing reference or test image"}', status=400)
            
        # 4. Run the model inference
        im1 = cached_transforms(Image.open(ref_file.stream).convert("RGB")).unsqueeze(0).to(CONFIG['device'])
        im2 = cached_transforms(Image.open(test_file.stream).convert("RGB")).unsqueeze(0).to(CONFIG['device'])
        
        with torch.no_grad():
            o1, o2 = cached_model(im1, im2)
            sim = F.cosine_similarity(o1, o2).item()
            
        display_prob = (sim + 1) / 2 * 100
        is_genuine = bool(sim > 0.4)
        
        return https_fn.Response(
            response=f'{{"similarity": {display_prob:.2f}, "is_genuine": {"true" if is_genuine else "false"}}}',
            status=200,
            headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
        )
    except Exception as e:
        return https_fn.Response(f'{{"error": "{str(e)}"}}', status=500, headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"})