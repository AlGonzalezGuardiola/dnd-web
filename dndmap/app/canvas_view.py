from PIL import Image, ImageTk
import tkinter as tk

ANCHO = 800
ALTO = 600

class CanvasView:
    def __init__(self, parent, on_right_click, on_back_click):
        self.canvas = tk.Canvas(parent, width=ANCHO, height=ALTO, bg="black")
        self.canvas.pack()
        self.canvas.bind("<Button-3>", on_right_click)
        self.image_ref = None
        self.on_back_click = on_back_click

    def draw_map(self, image_path, historial_existente):
        self.canvas.delete("all")
        img = Image.open(image_path).resize((ANCHO, ALTO))
        self.image_ref = ImageTk.PhotoImage(img)
        self.canvas.create_image(0, 0, anchor="nw", image=self.image_ref)

        # botón volver
        if historial_existente:
            self.canvas.create_text(
                10, 10,
                text="<- Volver",
                anchor="nw",
                fill="white",
                font=("Arial", 12, "bold"),
                tags="volver"
            )
            self.canvas.tag_bind("volver", "<Button-1>", self.on_back_click)


    def draw_pin(self, x, y, label, callback):
        pin_text = self.canvas.create_text(
            x, y,
            text=label,
            fill="white",
            font=("Arial", 16, "bold"),
            anchor="center"
        )
        self.canvas.tag_bind(pin_text, "<Button-1>", callback)