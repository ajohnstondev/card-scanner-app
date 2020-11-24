import React, { Fragment, useState, useEffect } from "react";
import Cropper from "./Cropper";
import appIcon from "../res/images/logo.png";
import "./Snipper.scss";
import axios from "axios";

const {
  ipcRenderer,
  desktopCapturer,
  screen,
  shell,
  remote,
} = require("electron");

const BrowserWindow = remote.BrowserWindow;
const dev = process.env.NODE_ENV === "development";
const path = require("path");
const Jimp = require("jimp");
const screenSize = screen.getPrimaryDisplay().size;
const fs = require("fs");
const { post } = require("axios");

let snipWindow = null,
  mainWindow = null;

// 5 seconds
const RECURRING_TIME = 1000 * 60 * 5;

function destroyCurrentWindow() {
  getCurrentWindow().close();
}

function minimizeCurrentWindow() {
  getCurrentWindow().minimize();
}

function getCurrentWindow() {
  return remote.getCurrentWindow();
}

function getAllInstances() {
  return BrowserWindow.getAllWindows();
}

function getMainInstance() {
  let instances = getAllInstances();
  return instances.filter((instance) => {
    return instance.id !== getCurrentWindow().id;
  })[0];
}

function getScreenShot(callback, imageFormat = "image/png") {
  const handleStream = (stream) => {
    // Create hidden video tag
    let video_dom = document.createElement("video");
    video_dom.style.cssText = "position:absolute;top:-10000px;left:-10000px;";
    // Event connected to stream
    video_dom.onloadedmetadata = function () {
      // Set video ORIGINAL height (screenshot)
      video_dom.style.height = this.videoHeight + "px"; // videoHeight
      video_dom.style.width = this.videoWidth + "px"; // videoWidth

      // Create canvas
      let canvas = document.createElement("canvas");
      canvas.width = this.videoWidth;
      canvas.height = this.videoHeight;
      let ctx = canvas.getContext("2d");
      // Draw video on canvas
      ctx.drawImage(video_dom, 0, 0, canvas.width, canvas.height);

      if (callback) {
        // Save screenshot to base64
        callback(canvas.toDataURL(imageFormat));
      } else {
        console.log("Need callback!");
      }

      // Remove hidden video tag
      video_dom.remove();
      try {
        // Destroy connect to stream
        stream.getTracks()[0].stop();
      } catch (e) { }
    };
    video_dom.src = URL.createObjectURL(stream);
    document.body.appendChild(video_dom);
  };

  const handleError = (e) => {
    console.log(e);
  };

  desktopCapturer.getSources({ types: ["screen"] }, (error, sources) => {
    if (error) throw error;
    for (let i = 0; i < sources.length; ++i) {
      // Filter: main screen
      if (
        sources[i].name === "Entire screen" ||
        sources[i].name === `Screen ${i + 1}`
      ) {
        navigator.webkitGetUserMedia(
          {
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: sources[i].id,
                minWidth: 1280,
                maxWidth: 4000,
                minHeight: 720,
                maxHeight: 4000,
              },
            },
          },
          handleStream,
          handleError
        );

        return;
      }
    }
  });
}

let intervalHandler = null;

function Snipper(props) {
  const [view, setView] = useState(() => {
    const context = global.location.search;
    return context.substr(1, context.length - 1);
  });
  const [regions, setRegions] = useState([]);
  const [isCapturing, toggleCapture] = useState(false);
  const [image, setImage] = useState("");
  useEffect(() => {
    let currentWnd = getCurrentWindow();
    if (currentWnd) {
      let width = currentWnd.getSize()[0];
      let height = regions.length * 42 + 73 + (regions.length > 0 ? 12 : 0);
      console.log(width, height);
      console.log("current regions: ", regions.length);
      currentWnd.setSize(width, height);

    }
  }, [regions])

  function captureScreen(coordinates, e) {
    mainWindow = getCurrentWindow();
    mainWindow.hide();

    setTimeout(() => {
      getScreenShot((base64data) => {
        let encondedImageBuffer = new Buffer(
          base64data.replace(/^data:image\/(png|gif|jpeg);base64,/, ""),
          "base64"
        );

        Jimp.read(encondedImageBuffer, (err, image) => {
          if (err) throw err;

          let crop = coordinates
            ? image.crop(
              coordinates.x,
              coordinates.y,
              parseInt(coordinates.width, 10),
              parseInt(coordinates.height, 10)
            )
            : image.crop(0, 0, screenSize.width, screenSize.height);

          crop.getBase64("image/png", (err, base64data) => {
            // setImage(base64data);
            mainWindow.show();
          });
        });
      });
    }, 200);
  }

  async function sendCaptureRequest(regionList){
    // send to backend
    const corsProxy = 'https://cors-anywhere.herokuapp.com/';
    var requestUrl = 'http://192.168.1.112:8000/detect/test/';

    // requestUrl = `${corsProxy}${requestUrl}`;
    console.log("sendCaptureRequest");
    console.log(regionList);
    const res = await axios.post(requestUrl, {"regionList": regionList});
    console.log(res);
  }

  function startCaptureScreen() {
    intervalHandler = setInterval(() => {
      getScreenShot(async (base64data) => {
        let encondedImageBuffer = new Buffer(
          base64data.replace(/^data:image\/(png|gif|jpeg);base64,/, ""),
          "base64"
        );

        const promises = regions.map((region, index) => {
          return new Promise((resolve, reject) => {
            Jimp.read(encondedImageBuffer, (err, image) => {
              if (err) throw err;

              const crop = image.crop(
                region.x,
                region.y,
                parseInt(region.width, 10),
                parseInt(region.height, 10)
              );
              crop.getBase64("image/png", (err, base64data) => {
                if (err) return reject(err);
                if(index === 1) {
                  setImage(base64data);
                }
                
                resolve({"region_name": region.name, "image64": base64data});
              });
            });
          });
        });
        const regionList = await Promise.all(promises);
        sendCaptureRequest(regionList);
        // Jimp.read(encondedImageBuffer, async (err, image) => {
        //   if (err) throw err;

        //   const promises = regions.map((region, index) => {

        //     return new Promise((resolve, reject) => {
        //       const crop = image.crop(
        //         region.x,
        //         region.y,
        //         parseInt(region.width, 10),
        //         parseInt(region.height, 10)
        //       );
        //       crop.getBase64("image/png", (err, base64data) => {
        //         if (err) return reject(err);
        //         if(index === 0) {
        //           setImage(base64data);
        //         }
                
        //         resolve({"region_name": region.name, "image64": base64data});
        //       });
        //     });
        //   });
          
        //   const regionList = await Promise.all(promises);
        //   sendCaptureRequest(regionList);
          
        // });
      });
    }, 3000);
  }

  function initCropper(e) {
    mainWindow = getCurrentWindow();
    mainWindow.hide();

    snipWindow = new BrowserWindow({
      x: 0,
      y: 0,
      width: screenSize.width,
      height: screenSize.height,
      frame: false,
      transparent: true,
      resizable: false,
      minHeight: screenSize.height
    });

    snipWindow.on("close", () => {
      snipWindow = null;
    });

    ipcRenderer.once("snip", (event, data) => {
      console.log("region coord: ", data);
      setRegions(regions.concat(data));
      mainWindow.show();
      captureScreen(data,null);
    });

    ipcRenderer.once("cancelled", (event) => {
      mainWindow.show();
    });

    snipWindow.loadURL(
      path.join("file://", __dirname, "/index.html") + "?snip"
    );
  }

  function snip(region) {
    const { name, x, y, width, height } = region;
    getMainInstance().webContents.send("snip", {
      name,
      x: (screenSize.width * x) / 100,
      y: (screenSize.height * y) / 100,
      width: (screenSize.width * width) / 100,
      height: (screenSize.height * height) / 100,
    });
    destroyCurrentWindow(null);
  }

  function destroySnipView(e) {
    getMainInstance().webContents.send("cancelled");
    destroyCurrentWindow(null);
  }

  function removeRegion(index) {
    return () => {
      setRegions(
        regions.filter((region, regionIndex) => regionIndex !== index)
      );
    };
  }

  function stopCapture() {
    toggleCapture(false);
    if (intervalHandler) {
      clearInterval(intervalHandler);
      intervalHandler = null;
    }
  }

  function startCapture() {
    toggleCapture(true);
    startCaptureScreen();
  }

  function upload() { }

  return (
    <Fragment>
      {view === "main" ? (
        <Fragment>
          <div className="app-body">
            <div className="title-bar">
              <div className="title">
                <img src={appIcon} />
                <div className="move-anchor"> &ndash; Card Scanner</div>
              </div>
              <div className="status-btns">
                <div
                  className={"status-btn stop-btn " + (isCapturing ? "visible" + " nodrag-btn" : "invisible" + " drag-btn")}
                  onClick={stopCapture}
                >
                  Stop Capture
                </div>
                {regions.length > 0 && (
                  <div
                    className={"status-btn start-btn " + (!isCapturing ? "visible" + " nodrag-btn" : "invisible" + " drag-btn")}
                    onClick={startCapture}
                  >
                    Start Capture
                  </div>
                )}
              </div>
              <div>
                <span
                  className="windows-btn"
                  title="minimize"
                  onClick={minimizeCurrentWindow}
                >
                  &ndash;
                </span>
                <span
                  className="windows-btn"
                  title="close"
                  onClick={destroyCurrentWindow}
                >
                  &times;
                </span>
              </div>
            </div>

            <div className="sub-title-bar">
              {regions.length === 0 ? (
                <span>No captures added</span>
              ) : (
                  <span><span className="value">{regions.length}</span> capture(s) added</span>
                )}
              <div className="add-btn" onClick={initCropper}>
                + Add Capture
              </div>
            </div>

            {regions.length > 0 &&
              <div className="items">

                {regions.map((region, index) => (
                  <div
                    className="item"
                    key={index}
                  >
                    <span>{region.name}</span>
                    <span
                      className="windows-btn"
                      title="Remove"
                      onClick={removeRegion(index)}
                    >
                      &times; Remove
                </span>
                  </div>
                ))}
              </div>
            }
            {image && (
              <div className="snipped-image">
                <img className="preview" src={image} alt="" />
              </div>
            )}
          </div>
        </Fragment>
      ) : (
          <Cropper snip={snip} destroySnipView={destroySnipView} />
        )}
    </Fragment>
  );
}

export default Snipper;
