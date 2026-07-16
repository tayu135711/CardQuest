from __future__ import annotations

import random
from pathlib import Path

from kivy.app import App
from kivy.clock import Clock
from kivy.lang import Builder
from kivy.properties import BooleanProperty, NumericProperty, StringProperty
from kivy.uix.screenmanager import Screen, ScreenManager, SlideTransition

from cardquest.models import CatchRecord
from cardquest.services.aruco import detect_markers, texture_to_bgr
from cardquest.services.storage import add_catch, build_default_state, load_state, save_state


KV = """
<HomeScreen>:
    BoxLayout:
        orientation: "vertical"
        padding: 24
        spacing: 18
        canvas.before:
            Color:
                rgba: 0.09, 0.12, 0.16, 1
            Rectangle:
                pos: self.pos
                size: self.size
        Label:
            text: "CardQuest"
            font_size: 42
            bold: True
            size_hint_y: None
            height: "80dp"
        Label:
            text: "Camera-driven collection + fishing prototype"
            font_size: 18
            size_hint_y: None
            height: "40dp"
        Widget:
        Button:
            text: "Open Camera"
            size_hint_y: None
            height: "56dp"
            on_release: app.go_camera()
        Button:
            text: "View Collection"
            size_hint_y: None
            height: "56dp"
            on_release: app.go_collection()
        Button:
            text: "Reset Save"
            size_hint_y: None
            height: "56dp"
            on_release: app.reset_state()

<CameraScreen>:
    BoxLayout:
        orientation: "vertical"
        padding: 12
        spacing: 12
        canvas.before:
            Color:
                rgba: 0.04, 0.04, 0.06, 1
            Rectangle:
                pos: self.pos
                size: self.size
        Camera:
            id: camera_view
            play: True
            resolution: (1280, 720)
        Label:
            text: root.status_text
            size_hint_y: None
            height: "36dp"
        BoxLayout:
            size_hint_y: None
            height: "56dp"
            spacing: 12
            Button:
                text: "Back"
                on_release: app.go_home()
            Button:
                text: "Scan Now"
                on_release: root.scan_once()

<GameScreen>:
    BoxLayout:
        orientation: "vertical"
        padding: 20
        spacing: 16
        canvas.before:
            Color:
                rgba: 0.08, 0.10, 0.10, 1
            Rectangle:
                pos: self.pos
                size: self.size
        Label:
            text: "Fishing Mini-Game"
            font_size: 28
            size_hint_y: None
            height: "40dp"
        Label:
            text: root.prompt_text
        Label:
            text: root.progress_text
            font_size: 20
        Widget:
        BoxLayout:
            size_hint_y: None
            height: "56dp"
            spacing: 12
            Button:
                text: "Reel"
                disabled: not root.running
                on_release: root.reel()
            Button:
                text: "Skip"
                on_release: app.finish_fishing(False)

<CollectionScreen>:
    BoxLayout:
        orientation: "vertical"
        padding: 18
        spacing: 10
        canvas.before:
            Color:
                rgba: 0.13, 0.09, 0.06, 1
            Rectangle:
                pos: self.pos
                size: self.size
        Label:
            text: "Collection"
            font_size: 28
            size_hint_y: None
            height: "44dp"
        Label:
            text: root.collection_text
        ScrollView:
            do_scroll_x: False
            GridLayout:
                cols: 1
                size_hint_y: None
                height: self.minimum_height
                spacing: 8
                padding: 4
                Label:
                    text: root.catch_text
                    size_hint_y: None
                    height: self.texture_size[1] + 20
        BoxLayout:
            size_hint_y: None
            height: "56dp"
            spacing: 12
            Button:
                text: "Home"
                on_release: app.go_home()
            Button:
                text: "Camera"
                on_release: app.go_camera()
"""


class HomeScreen(Screen):
    pass


class CameraScreen(Screen):
    status_text = StringProperty("Ready to detect markers.")
    marker_locked = BooleanProperty(False)

    def on_pre_enter(self, *_args):
        self.status_text = "Point the camera at a marker card."
        self.marker_locked = False
        Clock.schedule_interval(self._scan_frame, 0.5)

    def on_leave(self, *_args):
        Clock.unschedule(self._scan_frame)

    def scan_once(self):
        self._scan_frame(0)

    def _scan_frame(self, _dt):
        if self.marker_locked:
            return

        camera = self.ids.get("camera_view")
        if camera is None or not camera.texture:
            self.status_text = "Camera not ready."
            return

        frame_bgr = texture_to_bgr(camera.texture)
        if frame_bgr is None:
            self.status_text = "Waiting for camera frame."
            return

        detections = detect_markers(frame_bgr)
        if not detections:
            self.status_text = "No marker detected yet."
            return

        marker_id = detections[0].marker_id
        self.marker_locked = True
        self.status_text = f"Marker detected: {marker_id}"
        app = App.get_running_app()
        app.begin_fishing(marker_id)


class GameScreen(Screen):
    prompt_text = StringProperty("Press Reel to hit the timing window.")
    progress_text = StringProperty("0 / 3")
    running = BooleanProperty(False)
    marker_id = NumericProperty(-1)
    target_hits = NumericProperty(3)
    current_hits = NumericProperty(0)

    def start_round(self, marker_id: int):
        self.marker_id = marker_id
        self.target_hits = random.randint(2, 5)
        self.current_hits = 0
        self.running = True
        self.prompt_text = f"Character {marker_id} is fishing."
        self._update_progress()

    def reel(self):
        if not self.running:
            return
        if random.random() < 0.8:
            self.current_hits += 1
            self.prompt_text = "Good timing!"
        else:
            self.prompt_text = "Missed the window."
        self._update_progress()
        if self.current_hits >= self.target_hits:
            self.running = False
            App.get_running_app().finish_fishing(True)

    def _update_progress(self):
        self.progress_text = f"{self.current_hits} / {self.target_hits}"


class CollectionScreen(Screen):
    collection_text = StringProperty("")
    catch_text = StringProperty("")

    def on_pre_enter(self, *_args):
        self.refresh()

    def refresh(self):
        app = App.get_running_app()
        state = app.state
        catches = state.get("catches", [])
        characters = {item["id"]: item for item in state.get("characters", [])}
        fish = {item["id"]: item for item in state.get("fish", [])}

        unique_characters = sorted({row["character_id"] for row in catches})
        unique_fish = sorted({row["fish_id"] for row in catches})
        self.collection_text = (
            f"Unlocked characters: {len(unique_characters)} / {len(characters)}\n"
            f"Caught fish: {len(unique_fish)} / {len(fish)}"
        )

        if catches:
            lines = []
            for row in reversed(catches[-20:]):
                character_name = characters.get(row["character_id"], {}).get("name", f"Character {row['character_id']}")
                fish_name = fish.get(row["fish_id"], {}).get("name", f"Fish {row['fish_id']}")
                lines.append(f"{row['caught_at']} - {character_name} caught {fish_name}")
            self.catch_text = "\n".join(lines)
        else:
            self.catch_text = "No catches yet."


class CardQuestRoot(ScreenManager):
    pass


class CardQuestApp(App):
    title = "CardQuest"

    def build(self):
        Builder.load_string(KV)
        self.state = load_state(self._state_base_dir())

        self.root = CardQuestRoot(transition=SlideTransition(duration=0.2))
        self.root.add_widget(HomeScreen(name="home"))
        self.root.add_widget(CameraScreen(name="camera"))
        self.root.add_widget(GameScreen(name="game"))
        self.root.add_widget(CollectionScreen(name="collection"))
        return self.root

    def _state_base_dir(self) -> str:
        return str(Path.cwd())

    def on_start(self):
        self.go_home()

    def go_home(self):
        self.root.current = "home"

    def go_camera(self):
        self.root.current = "camera"

    def go_collection(self):
        screen = self.root.get_screen("collection")
        screen.refresh()
        self.root.current = "collection"

    def begin_fishing(self, marker_id: int):
        game = self.root.get_screen("game")
        game.start_round(marker_id)
        self.root.current = "game"

    def finish_fishing(self, success: bool):
        if not success:
            self.go_collection()
            return

        game = self.root.get_screen("game")
        fish_pool = self.state.get("fish", [])
        if not fish_pool:
            self.go_collection()
            return

        fish_row = self._choose_fish(game.marker_id)
        catch = CatchRecord.create(character_id=int(game.marker_id), fish_id=int(fish_row["id"]))
        self.state = add_catch(self.state, catch)
        save_state(self.state, self._state_base_dir())
        self.go_collection()

    def reset_state(self):
        self.state = build_default_state()
        save_state(self.state, self._state_base_dir())
        self.go_home()

    def _choose_fish(self, marker_id: int):
        fish_pool = self.state.get("fish", [])
        character = next((item for item in self.state.get("characters", []) if item["id"] == int(marker_id)), None)
        profile = (character or {}).get("fishing_profile", {})
        rare_bonus = float(profile.get("rare_bonus", 0.0))

        weighted_pool = []
        for row in fish_pool:
            rarity = row.get("rarity", "common")
            if rarity == "common":
                weight = 60
            elif rarity == "rare":
                weight = 28 + int(rare_bonus * 100)
            elif rarity == "epic":
                weight = 10 + int(rare_bonus * 50)
            else:
                weight = 5
            weighted_pool.extend([row] * max(weight, 1))

        return random.choice(weighted_pool) if weighted_pool else random.choice(fish_pool)
