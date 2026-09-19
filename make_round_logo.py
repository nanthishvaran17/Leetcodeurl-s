from PIL import Image, ImageDraw
import os

def make_circle_logo():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_path = os.path.join(base_dir, "transparent_logo.png")
    output_path = os.path.join(base_dir, "round_logo.png")
    
    if not os.path.exists(input_path):
        print(f"Error: {input_path} not found.")
        return

    # Open the image and convert to RGBA
    img = Image.open(input_path).convert("RGBA")
    
    # Create a circular mask
    mask = Image.new("L", img.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, img.size[0], img.size[1]), fill=255)
    
    # Apply the mask
    result = img.copy()
    result.putalpha(mask)
    
    # Save the output
    result.save(output_path, "PNG")
    print(f"Successfully saved round logo to {output_path}")

if __name__ == "__main__":
    make_circle_logo()
