import requests

# 1. Paste your LIVE URL here
url = "https://us-central1-lingo-handwriting-recognition.cloudfunctions.net/verify_signature"

# 2. Open your two test images
files = {
    'reference': open('SignatureTestImages/O1.png', 'rb'),
    'test': open('SignatureTestImages/O11.png', 'rb')
}

print("Sending request... (Waiting for cold start)")

# 3. Send the POST request
response = requests.post(url, files=files)

# 4. Print the result!
print(f"Status Code: {response.status_code}")
print(f"Response: {response.text}")