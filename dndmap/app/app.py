import tkinter as tk
from .canvas_view import CanvasView
from .map_manager import MapManager
from .controller import Controller
from .data_manager import Data
from tkinter import filedialog, simpledialog, messagebox
import os

DATA_PATH = os.path.join("data", "data.json")

class App:
    def __init__(self, root):
        self.root = root
        self.root.title("Mapas DnD")

        self.manager = MapManager()
        self.data = Data(DATA_PATH)
        self.manager.mapas = self.data.mapas
        self.manager.mapa_actual = self.data.mapa_inicial

        if not self.manager.mapa_actual:
            self.crear_primer_mapa()

        self.view = CanvasView(self.root, self.on_right_click, self.on_back_click)
        self.controller = Controller(self.root, self.view, self.manager, self.data)
        self.controller.render_map()

    def on_right_click(self, event):
        self.controller.on_right_click(event)

    def on_back_click(self, event):
        self.controller.back(event)

    def crear_primer_mapa(self):
        messagebox.showinfo("Primer mapa", "Selecciona el mapa inicial", parent=self.root)
        ruta = filedialog.askopenfilename(
            title="Mapa inicial",
            filetypes=[("Imágenes", "*.png *.jpg *.jpeg")],
            parent=self.root
        )
        if not ruta:
            self.root.destroy()
            exit()

        mapa_id = simpledialog.askstring("ID del mapa", "Nombre del mapa inicial", parent=self.root)
        if not mapa_id:
            self.root.destroy()
            exit()

        self.manager.mapas[mapa_id] = {"imagen": ruta, "pines": []}
        self.manager.mapa_actual = mapa_id
        self.data.mapas = self.manager.mapas
        self.data.mapa_inicial = mapa_id
        self.data.save()