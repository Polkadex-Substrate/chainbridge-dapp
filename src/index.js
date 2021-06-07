import React from 'react';
import ReactDOM from 'react-dom';
import { UseWalletProvider } from 'use-wallet';

import App from './App';
import config from './config'

ReactDOM.render(
  <UseWalletProvider
    chainId={config.CHAIN_ID}
    connectors={{
      walletconnect: { rpcUrl: config.RPC_URL },
    }}
  >
    <App />
  </UseWalletProvider>,
  document.getElementById('root')
);
