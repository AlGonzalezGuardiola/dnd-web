class MapManager:
    def __init__(self):
        self.mapas = {}  # id -> {"imagen": path, "pines": [pin]}
        self.mapa_actual = None
        self.historial = []

    def change_map(self, mapa_id):
        if self.mapa_actual:
            self.historial.append(self.mapa_actual)
        self.mapa_actual = mapa_id

    def back(self):
        if self.historial:
            self.mapa_actual = self.historial.pop()
            return self.mapa_actual
        return None