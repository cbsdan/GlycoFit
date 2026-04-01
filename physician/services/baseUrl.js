const environments = {
  development: {
    deviceLocal: "http://192.168.9.175:4000/api/v1",
  },
  production: "https://glycofit-app-backend-n44y8.ondigitalocean.app/api/v1",
};

const getBaseUrl = () => {
  const isDev = __DEV__;

  if (isDev) {
    return environments.development.deviceLocal;
  } else {
    return environments.production;
  }
};

const baseURL = getBaseUrl();

export default baseURL;
