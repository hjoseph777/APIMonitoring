from PIL import Image, ImageDraw, ImageFilter

try:
    print("Generating high-quality ICO using Pillow...")
    
    # Create a 256x256 image with transparent background
    size = 256
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 1. Base dark rounded square
    box = [16, 16, 240, 240]
    draw.rounded_rectangle(box, radius=48, fill="#1e293b", outline="#0f172a", width=4)
    
    # 2. Outer glowing ring (blue)
    ring_box = [24, 24, 232, 232]
    draw.rounded_rectangle(ring_box, radius=40, fill=None, outline="#3b82f6", width=4)
    
    # 3. Inner core circle
    circle_box = [52, 52, 204, 204]
    draw.ellipse(circle_box, fill="#0f172a", outline="#06b6d4", width=6)
    
    # 4. Pulse / Heartbeat Line (green)
    pulse_points = [
        (64, 128),
        (92, 128),
        (112, 88),
        (144, 168),
        (164, 128),
        (192, 128)
    ]
    draw.line(pulse_points, fill="#10b981", width=12, joint="curve")
    
    # 5. Nodes
    draw.ellipse([56, 120, 72, 136], fill="#10b981")
    draw.ellipse([184, 120, 200, 136], fill="#10b981")

    print("Saving as resources/icon.ico...")
    img.save("resources/icon.ico", format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (32, 32), (16, 16)])
    print("Success! Created resources/icon.ico")
except Exception as e:
    print(f"Error: {e}")
