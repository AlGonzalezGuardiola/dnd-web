import json
import os

class Data:
    def __init__(self, path):
        self.path = path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.data = {"mapa_inicial": None, "mapas": {}}
        self.load()

    def load(self):
        try:
            with open(self.path, "r", encoding="utf-8") as f:
                self.data = json.load(f)
        except FileNotFoundError:
            self.data = {"mapa_inicial": None, "mapas": {}}

    def save(self):
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=4)

    @property
    def mapas(self):
        return self.data["mapas"]

    @mapas.setter
    def mapas(self, value):
        self.data["mapas"] = value

    @property
    def mapa_inicial(self):
        return self.data["mapa_inicial"]

    @mapa_inicial.setter
    def mapa_inicial(self, value):
        self.data["mapa_inicial"] = value