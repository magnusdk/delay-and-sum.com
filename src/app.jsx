import { useRef } from "preact/hooks";
import { MainView } from "./components/main-view.jsx";
import { Timeline } from "./components/timeline.jsx";
import { Menu } from "./components/menu.jsx";
import { BeamProfile } from "./components/beam-profile.jsx";

export function App() {
  const supported = useRef(null);
  if (supported.current === null) {
    const canvas = document.createElement("canvas");
    supported.current = !!canvas.getContext("webgl2");
  }

  if (!supported.current) {
    return (
      <div>
        <p>Sorry, your browser does not support WebGL 2 :/</p>
        <p>Please try another browser.</p>
      </div>
    );
  }

  return (
    <div class="fillSpace">
      <div class="horizontalContainer">
        <div class="verticalContainer">
          <MainView />
          <Timeline />
        </div>
        <Menu />
      </div>
      <BeamProfile />
    </div>
  );
}
