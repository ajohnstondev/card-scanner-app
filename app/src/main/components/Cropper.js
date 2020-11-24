import React, { useState, useEffect } from "react";
import RegionSelect from "react-region-select";
import "./Snipper.scss";

const { screen } = require("electron");
const screenSize = screen.getPrimaryDisplay().size;

const style = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "solid 2px #3a38d2",
  margin: "5px",
};

const regionStyle = {
  boxShadow: "0 0 0 9999em rgba(0, 0, 0, 0.5)",
};

function Cropper({ snip, destroySnipView }) {
  const [capturing, setCapturing] = useState(false);
  const [regionName, setRegionName] = useState("");
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    const eventHandler = document.addEventListener("keydown", (event) => {
      if (event.keyCode === 27) {
        destroySnipView();
      }
    });

    return function cleanup() {
      document.removeEventListener(eventHandler);
    };
  }, []);

  function regionRenderer(regionProps) {
    if (!regionProps.isChanging) {
      return (
        <div className="cropper-controls" >
          <input
            className="form-control"
            value={regionName}
            onChange={(e) => setRegionName(e.target.value)}
          />
          <button
            className="btn btn-primary mx-1"
            onClick={() => {
              const region = regions[0];
              region.name = regionName;
              snip(region);
            }}
          >
            Capture
          </button>
          <button className="btn btn-secondary" onClick={destroySnipView}>
            Cancel
          </button>
        </div>
      );
    }
  }

  const screenStyle = {
    width: screenSize.width,
    height: screenSize.height,
  };

  if (!capturing) {
    screenStyle.boxShadow = "inset 0 0 0 9999em rgba(0, 0, 0, 0.5)";
  }

  return (
    <RegionSelect
      maxRegions={1}
      regions={regions}
      regionStyle={regionStyle}
      regionRenderer={regionRenderer}
      constraint
      onChange={(regions) => setRegions(regions)}
      style={{ border: "1px solid black" }}
    >
      <div style={screenStyle} onMouseDown={() => setCapturing(true)}></div>
    </RegionSelect>
  );
}

export default Cropper;
