from PIL import Image
import os

def convert_to_ico():
    img = Image.open('Logo.png')
    # Ensure it's RGBA
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    
    # Standard Windows icon sizes
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    
    # Save as ICO
    ico_path = os.path.join('build', 'icon.ico')
    img.save(ico_path, format='ICO', sizes=sizes)
    print(f"Successfully created {ico_path}")

if __name__ == "__main__":
    convert_to_ico()
