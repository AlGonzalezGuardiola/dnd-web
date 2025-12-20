from tkinter import filedialog, simpledialog, messagebox

class Controller:
    def __init__(self, root, view, manager, data):
        self.root = root
        self.view = view
        self.manager = manager
        self.data = data

    def on_right_click(self, event):
        nombre = simpledialog.askstring("Nuevo pin", "Nombre del lugar:", parent=self.root)
        if not nombre:
            return

        destino = simpledialog.askstring("Destino", "ID del mapa destino:", parent=self.root)
        if not destino:
            return

        if destino not in self.manager.mapas:
            ruta = filedialog.askopenfilename(
                title="Imagen del nuevo mapa",
                filetypes=[("Imágenes", "*.png *.jpg *.jpeg")],
                parent=self.root
            )
            if not ruta:
                return
            self.manager.mapas[destino] = {"imagen": ruta, "pines": []}

        x_rel = event.x / 800
        y_rel = event.y / 600

        pin = {"x": x_rel, "y": y_rel, "nombre": nombre, "destino": destino}
        self.manager.mapas[self.manager.mapa_actual]["pines"].append(pin)
        self.data.save()

        self.render_map()


    def render_map(self):
        mapa = self.manager.mapas[self.manager.mapa_actual]
        historial = bool(self.manager.historial)
        self.view.draw_map(mapa["imagen"], historial)

        for pin in mapa["pines"]:
            x = int(pin["x"] * 800)
            y = int(pin["y"] * 600)
            self.view.draw_pin(
                x, y, 
                pin["nombre"], 
                lambda e, d=pin["destino"]: self.change_map(d)
    )
    def change_map(self, mapa_id):
        self.manager.change_map(mapa_id)
        self.render_map()

    def back(self, event=None):
        anterior = self.manager.back()
        if anterior:
            self.render_map()