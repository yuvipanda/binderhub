import { BinderRepository } from "@jupyterhub/binderhub-client";
import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Progress, PROGRESS_STATES } from "./Progress.jsx";
import { Spec } from "../spec.js";

/**
 *
 * @param {string} serverUrl
 * @param {string} token
 * @param {string} urlPath
 */
function redirectToRunningServer(serverUrl, token, urlPath) {
  const redirectUrl = new URL(urlPath, serverUrl);
  redirectUrl.searchParams.append("token", token);
  window.location.href = redirectUrl.toString();
}

/**
 *
 * @param {URL} baseUrl
 * @param {Spec} spec
 * @param {Terminal} term
 * @param {FitAddon} fitAddon
 * @param {(l: boolean) => void} setIsLaunching
 * @param {(p: PROGRESS_STATES) => void} setProgressState
 * @param {(e: boolean) => void} setEnsureLogsVisible
 */
async function buildImage(
  baseUrl,
  spec,
  term,
  fitAddon,
  setIsLaunching,
  setProgressState,
  setEnsureLogsVisible,
) {
  const buildEndPointURL = new URL("build/", baseUrl);
  const image = new BinderRepository(spec.buildSpec, buildEndPointURL);
  // Clear the last line written, so we start from scratch
  term.write("\x1b[2K\r");
  fitAddon.fit();
  for await (const data of image.fetch()) {
    // Write message to the log terminal if there is a message
    if (data.message !== undefined) {
      // Write out all messages to the terminal!
      term.write(data.message);
      // Resize our terminal to make sure it fits messages appropriately
      fitAddon.fit();
    } else {
      console.log(data);
    }

    switch (data.phase) {
      case "failed": {
        image.close();
        setIsLaunching(false);
        setProgressState(PROGRESS_STATES.FAILED);
        setEnsureLogsVisible(true);
        break;
      }
      case "ready": {
        setProgressState(PROGRESS_STATES.SUCCESS);
        image.close();
        redirectToRunningServer(
          data.url,
          data.token,
          spec.runtimeParams.urlPath,
        );
        console.log(data);
        break;
      }
      case "building": {
        setProgressState(PROGRESS_STATES.BUILDING);
        break;
      }
      case "waiting": {
        setProgressState(PROGRESS_STATES.WAITING);
        break;
      }
      case "pushing": {
        setProgressState(PROGRESS_STATES.PUSHING);
        break;
      }
      case "built": {
        setProgressState(PROGRESS_STATES.PUSHING);
        break;
      }
      case "launching": {
        setProgressState(PROGRESS_STATES.LAUNCHING);
        break;
      }
      default: {
        console.log("Unknown phase in response from server");
        console.log(data);
        break;
      }
    }
  }
}

/**
 * @typedef {object} ImageLogsProps
 * @prop {(t: Terminal) => void} setTerm
 * @prop {(f: FitAddon) => void} setFitAddon
 * @prop {boolean} logsVisible
 * @prop {(l: boolean) => void} setLogsVisible
 *
 * @param {ImageLogsProps} props
 * @returns
 */
function ImageLogs({ setTerm, setFitAddon, logsVisible, setLogsVisible }) {
  const toggleLogsButton = useRef();
  useEffect(() => {
    async function setup() {
      const term = new Terminal({
        convertEol: true,
        disableStdin: true,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(document.getElementById("terminal"));
      fitAddon.fit();
      setTerm(term);
      setFitAddon(fitAddon);
      term.write("Logs will appear here when image is being built");
    }
    setup();
  }, []);

  return (
    <div className="card">
      <div className="card-header d-flex align-items-baseline">
        <span className="flex-fill">Build Logs</span>
        <button
          ref={toggleLogsButton}
          className="btn btn-link"
          type="button"
          aria-controls="terminal-container"
          onClick={() => {
            setLogsVisible(!logsVisible);
          }}
        >
          {logsVisible ? "hide" : "show"}
        </button>
      </div>
      <div
        className={`card-body bg-black ${logsVisible ? "" : "d-none"}`}
        id="terminal-container"
      >
        <div id="terminal"></div>
      </div>
    </div>
  );
}

/**
 * @typedef {object} BuildLauncherProps
 * @prop {URL} baseUrl
 * @prop {Spec} spec
 * @prop {boolean} isLaunching
 * @prop {(l: boolean) => void} setIsLaunching
 * @prop {PROGRESS_STATES} progressState
 * @prop {(p: PROGRESS_STATES) => void} setProgressState
 *
 * @param {BuildLauncherProps} props
 * @returns
 */
export function BuilderLauncher({
  baseUrl,
  spec,
  isLaunching,
  setIsLaunching,
  progressState,
  setProgressState,
}) {
  const [term, setTerm] = useState(null);
  const [fitAddon, setFitAddon] = useState(null);
  const [logsVisible, setLogsVisible] = useState(false);
  useEffect(() => {
    async function setup() {
      if (isLaunching) {
        await buildImage(
          baseUrl,
          spec,
          term,
          fitAddon,
          setIsLaunching,
          setProgressState,
          setLogsVisible,
        );
      }
    }
    setup();
  }, [isLaunching]);
  return (
    <div className="bg-light p-4">
      <Progress progressState={progressState} />
      <ImageLogs
        setTerm={setTerm}
        setFitAddon={setFitAddon}
        logsVisible={logsVisible}
        setLogsVisible={setLogsVisible}
      />
    </div>
  );
}
