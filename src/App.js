import "./App.css";
import { useEffect } from "react";
import * as THREE from "three";
import { ARButton } from "three/examples/jsm/webxr/ARButton";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { XREstimatedLight } from "three/examples/jsm/webxr/XREstimatedLight";

function App() {
  let reticle;
  let hitTestSource = null;
  let hitTestSourceRequested = false;

  let scene, camera, renderer;

  let models = [
    "./plesiosaurus.glb",
    "./Triceratops.glb",
    "./pteranodon.glb",
    "./velociraptor.glb",
    "./dilophosaurus.glb",
    "./carnage_dilophosaurus.glb",
    "./allosaurus.glb",
    "./t-rex.glb",
  ];
  let modelScaleFactor = [0.02, 0.04, 0.01, 0.02, 0.03, 0.03, 0.04, 0.04];
  const descriptions = [
    "Plesiosaurus adalah reptil laut besar yang hidup pada masa dinosaurus.",
    "Triceratops memiliki tiga tanduk di wajahnya dan pelindung tulang besar.",
    "Pteranodon adalah reptil terbang, bukan dinosaurus, dengan lebar sayap lebih dari 6 meter.",
    "Velociraptor adalah pemburu kecil yang cerdas dan sering berburu dalam kelompok.",
    "Dilophosaurus memiliki dua jambul di kepalanya dan dapat menyemburkan racun.",
    "Carnage Dilophosaurus adalah varian yang lebih besar dan lebih agresif.",
    "Allosaurus adalah predator besar yang hidup sebelum Tyrannosaurus Rex.",
    "Tyrannosaurus Rex adalah salah satu predator darat terbesar sepanjang masa.",
  ];
  let items = [];
  let itemSelectedIndex = 0;

  let controller;
  let lastPlacedObject = null;
  let initialPinchDistance = 0;

  useEffect(() => {
    init();
    setupFurnitureSelection();
    animate();
  }, []);

  function init() {
    let myCanvas = document.getElementById("canvas");
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      70,
      myCanvas.innerWidth / myCanvas.innerHeight,
      0.01,
      20
    );

    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    renderer = new THREE.WebGLRenderer({
      canvas: myCanvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(myCanvas.innerWidth, myCanvas.innerHeight);
    renderer.xr.enabled = true;

    // Don't add the XREstimatedLight to the scene initially
    // It doesn't have any estimated lighting values until an AR session starts
    const xrLight = new XREstimatedLight(renderer);
    xrLight.addEventListener("estimationstart", () => {
      // Swap the default light out for the estimated one so we start getting some estimated values.
      scene.add(xrLight);
      scene.remove(light);
      // The estimated lighting also provides an env cubemap which we apply here
      if (xrLight.environment) {
        scene.environment = xrLight.environment;
      }
    });

    xrLight.addEventListener("estimationend", () => {
      // Swap the lights back when we stop receiving estimated values
      scene.add(light);
      scene.remove(xrLight);

      // Revert back to the default environment
      // scene.environment =
    });

    let arButton = ARButton.createButton(renderer, {
      requiredFeatures: ["hit-test"],
      optionalFeatures: ["dom-overlay", "light-estimation"],
      domOverlay: { root: document.body },
    });
    arButton.style.bottom = "20%";
    document.body.appendChild(arButton);

    renderer.domElement.addEventListener("touchstart", onTouchStart, false);
    renderer.domElement.addEventListener("touchmove", onTouchMove, false);
    renderer.domElement.addEventListener("touchend", onTouchEnd, false);

    for (let i = 0; i < models.length; i++) {
      const loader = new GLTFLoader();
      loader.load(models[i], function (glb) {
        let model = glb.scene;
        items[i] = model;
      });
    }

    controller = renderer.xr.getController(0);
    controller.addEventListener("select", onSelect);
    scene.add(controller);

    reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial()
    );
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);
  }

  function onSelect() {
    if (reticle.visible && items[itemSelectedIndex]) {
      let newModel = items[itemSelectedIndex].clone();
      newModel.visible = true;
      // this one will set the position but not the rotation
      // newModel.position.setFromMatrixPosition(reticle.matrix);

      // this will set the position and the rotation to face you
      if (lastPlacedObject) {
        scene.remove(lastPlacedObject);
      }

      reticle.matrix.decompose(
        newModel.position,
        newModel.quaternion,
        newModel.scale
      );

      const cameraPosition = new THREE.Vector3();
      camera.getWorldPosition(cameraPosition);
      newModel.lookAt(cameraPosition);

      let scaleFactor = modelScaleFactor[itemSelectedIndex];
      newModel.scale.set(scaleFactor, scaleFactor, scaleFactor);

      scene.add(newModel);
      lastPlacedObject = newModel;

      const instructionBox = document.getElementById("instruction-box");
      instructionBox.style.opacity = "1";
      setTimeout(() => {
        instructionBox.style.opacity = "0";
      }, 4000);
    }
  }

  function onTouchStart(event) {
    if (event.touches.length === 2) {
      const dx = event.touches[0].pageX - event.touches[1].pageX;
      const dy = event.touches[0].pageY - event.touches[1].pageY;
      initialPinchDistance = Math.sqrt(dx * dx + dy * dy);
    }
  }

  function onTouchMove(event) {
    if (event.touches.length === 2 && lastPlacedObject) {
      const dx = event.touches[0].pageX - event.touches[1].pageX;
      const dy = event.touches[0].pageY - event.touches[1].pageY;
      const newPinchDistance = Math.sqrt(dx * dx + dy * dy);
      const scale = newPinchDistance / initialPinchDistance;

      lastPlacedObject.scale.multiplyScalar(scale);
      initialPinchDistance = newPinchDistance;
    }
  }

  function onTouchEnd(event) {
    initialPinchDistance = 0;
  }

  const onClicked = (e, selectItem, index) => {
    itemSelectedIndex = index;

    const descriptionBox = document.getElementById("info-box");
    const descriptionText = document.getElementById("description-text");

    descriptionText.innerText = descriptions[index];
    descriptionBox.style.opacity = "1";

    // remove image selection from others to indicate unclicked
    for (let i = 0; i < models.length; i++) {
      const el = document.querySelector(`#item` + i);
      el.classList.remove("clicked");
    }
    // set image to selected
    e.target.classList.add("clicked");
  };

  function setupFurnitureSelection() {
    for (let i = 0; i < models.length; i++) {
      const el = document.querySelector(`#item` + i);
      el.addEventListener("beforexrselect", (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClicked(e, items[i], i);
      });
    }
  }

  function animate() {
    renderer.setAnimationLoop(render);
  }

  function render(timestamp, frame) {
    if (frame) {
      const referenceSpace = renderer.xr.getReferenceSpace();
      const session = renderer.xr.getSession();

      if (hitTestSourceRequested === false) {
        session.requestReferenceSpace("viewer").then(function (referenceSpace) {
          session
            .requestHitTestSource({ space: referenceSpace })
            .then(function (source) {
              hitTestSource = source;
            });
        });

        session.addEventListener("end", function () {
          hitTestSourceRequested = false;
          hitTestSource = null;
        });

        hitTestSourceRequested = true;
      }

      if (hitTestSource) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length) {
          const hit = hitTestResults[0];

          reticle.visible = true;
          reticle.matrix.fromArray(
            hit.getPose(referenceSpace).transform.matrix
          );
        } else {
          reticle.visible = false;
        }
      }
    }

    renderer.render(scene, camera);
  }

  return <div className="App"></div>;
}

export default App;

