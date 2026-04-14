import NetInfo from "@react-native-community/netinfo";

const isOnlineState = (state) => {
  if (!state?.isConnected) {
    return false;
  }

  // null means unknown reachability; treat as online when connected.
  return state.isInternetReachable !== false;
};

export const isNetworkOnline = async () => {
  const state = await NetInfo.fetch();
  return isOnlineState(state);
};

export const onNetworkReconnected = (callback) => {
  let previousOnline = null;

  return NetInfo.addEventListener((state) => {
    const online = isOnlineState(state);

    if (previousOnline === null) {
      previousOnline = online;
      return;
    }

    if (online && !previousOnline) {
      callback();
    }

    previousOnline = online;
  });
};
