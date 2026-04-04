import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import OBSWebSocket from "obs-websocket-js";

import { OBS_WS_URL } from "../../../shared/constants";

type UseOBSWebSocketOptions = {
  url?: string;
  password?: string;
};

type OBSScene = {
  sceneName: string;
};

type UseOBSWebSocketResult = {
  connected: boolean;
  scenes: string[];
  switchScene: (sceneName: string) => Promise<void>;
  setSceneItemVisible: (sceneName: string, sourceName: string, visible: boolean) => Promise<void>;
  alertAll: (sceneName: string, sourceName: string) => Promise<void>;
};

export function useOBSWebSocket(options: UseOBSWebSocketOptions = {}): UseOBSWebSocketResult {
  const url = options.url ?? OBS_WS_URL;
  const password = options.password ?? "";

  const obsRef = useRef<OBSWebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [scenes, setScenes] = useState<string[]>([]);

  const refreshScenes = useCallback(async () => {
    if (!obsRef.current) {
      return;
    }

    const response = await obsRef.current.call("GetSceneList");
    const names = (response.scenes as OBSScene[]).map((scene) => scene.sceneName);
    setScenes(names);
  }, []);

  useEffect(() => {
    const obs = new OBSWebSocket();
    obsRef.current = obs;

    let mounted = true;

    const connect = async () => {
      try {
        await obs.connect(url, password);
        if (!mounted) {
          return;
        }
        setConnected(true);
        await refreshScenes();
      } catch {
        if (mounted) {
          setConnected(false);
        }
      }
    };

    connect();

    const onConnectionClosed = () => setConnected(false);
    obs.on("ConnectionClosed", onConnectionClosed);

    return () => {
      mounted = false;
      obs.off("ConnectionClosed", onConnectionClosed);
      obs.disconnect().catch(() => undefined);
      obsRef.current = null;
    };
  }, [password, refreshScenes, url]);

  const switchScene = useCallback(async (sceneName: string) => {
    if (!obsRef.current) {
      return;
    }
    await obsRef.current.call("SetCurrentProgramScene", { sceneName });
  }, []);

  const setSceneItemVisible = useCallback(
    async (sceneName: string, sourceName: string, visible: boolean) => {
      if (!obsRef.current) {
        return;
      }

      const item = await obsRef.current.call("GetSceneItemId", {
        sceneName,
        sourceName,
      });

      await obsRef.current.call("SetSceneItemEnabled", {
        sceneName,
        sceneItemId: item.sceneItemId,
        sceneItemEnabled: visible,
      });
    },
    [],
  );

  const alertAll = useCallback(
    async (sceneName: string, sourceName: string) => {
      await setSceneItemVisible(sceneName, sourceName, true);
      window.setTimeout(() => {
        setSceneItemVisible(sceneName, sourceName, false).catch(() => undefined);
      }, 2000);
    },
    [setSceneItemVisible],
  );

  return useMemo(
    () => ({
      connected,
      scenes,
      switchScene,
      setSceneItemVisible,
      alertAll,
    }),
    [alertAll, connected, scenes, setSceneItemVisible, switchScene],
  );
}
