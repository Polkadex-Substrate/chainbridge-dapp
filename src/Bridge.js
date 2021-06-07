import React, { useState, useCallback, useEffect, useMemo } from 'react';import Web3 from 'web3';
import { useWallet } from 'use-wallet';
import { providers as EthersProviders, constants as EthersConstants, utils as EthersUtils } from 'ethers';
import { Form, Input, Grid, Button, Loader } from 'semantic-ui-react';
import { create as createERC20 } from './lib/erc20';
import { create as createBridge } from './lib/bridge';
import { TxButton } from './substrate-lib/components';
import { NetworkSelector } from './components';
import config from './config';
import './Bridge.css';

const expandDecimals = (amount, decimals = 18) => {
  return EthersUtils.parseUnits(String(amount), decimals);
}

export default function Main (props) {
  const [status, setStatus] = useState(null);
  const [formState, setFormState] = useState({ tokenAddress: null, recipient: null, amount: 0, src: 'polkadex', dest: 'rinkeby' });
  const [loadingAccInfo, setLoadingAccInfo] = useState(false);
  const [pending, setPending] = useState(false);
  const [accInfo, setAccInfo] = useState(null);
  const { subAccount } = props;
  const { account: ethAccount, connect, ethereum } = useWallet();
  const { tokenAddress, recipient, amount, src, dest } = formState;
  const ethers = useMemo(() => (ethereum ? new EthersProviders.Web3Provider(ethereum) : null), [ethereum]);

  const signer = ethers ? ethers.getSigner() : null;
  
  const checkMetaMask = useCallback(async () => {
    const activate = (connector) => connect(connector);

    let web3;
    if (window.ethereum) {
      await window.ethereum.send('eth_requestAccounts');
      web3 = new Web3(window.ethereum);
    } else if (window.web3) {
      web3 = new Web3(window.web3.currentProvider);
    } else {
      return;
    }
    const result = await web3.eth.getAccounts();
    if (result && result.length > 0) {
      await activate('injected');
    }
  }, []);

  useEffect(() => {
    if (src === 'rinkeby') {
      checkMetaMask();
    }
    
  }, [checkMetaMask, src]);

  const onConnectWallet = () => {
    connect('injected');
  };

  const loadAccInfo = async (tokenAddress) => {
    setLoadingAccInfo(true);
    const erc20Token = createERC20(tokenAddress, signer);
    const [balance, allowance] = await Promise.all([erc20Token.balanceOf(ethAccount), erc20Token.allowance(ethAccount, config.ADDR_BRIDGE)]);
    setAccInfo({ balance, allowance });
    setLoadingAccInfo(false);
  }

  const onChange = async (_, data) => {
    if (data.state === 'tokenAddress') {
      if (src === 'rinkeby') {
        try {
          const tokenAddress = Web3.utils.toChecksumAddress(data.value);
          await loadAccInfo(tokenAddress)
        } catch (e) {
          setAccInfo(null);
        }
      }
    }
    setFormState(prev => ({ ...prev, [data.state]: data.value }));
  }

  const switchNetwork = async () => {
    setFormState(prev => ({ ...prev, src: prev.dest, dest: prev.src, tokenAddress: null, recipient: null, amount: 0 }))
    setAccInfo(null)
  }

  const onApprove = async () => {
    const erc20Token = createERC20(tokenAddress, signer);
    setPending(true);
    try {
      const txApprove = await erc20Token.approve(config.ADDR_BRIDGE, EthersConstants.MaxUint256);
      await txApprove.wait();
      console.log('approved');
      await loadAccInfo(tokenAddress)
    } catch (e) {
      console.error(e);
    }
    setPending(false);
  }

  const onDeposit = async () => {
    const erc20Token = createERC20(tokenAddress, signer);
    setPending(true);
    const decimals = await erc20Token.decimals();

    const data = EthersUtils.hexZeroPad(tokenAddress, 32) + // token Address (32 bytes)
            EthersUtils.hexZeroPad(EthersUtils.bigNumberify(expandDecimals(amount, decimals)).toHexString(), 32).substr(2) +    // Deposit Amount        (32 bytes)
            EthersUtils.hexZeroPad(EthersUtils.hexlify((recipient.length - 2)/2), 32).substr(2) +    // len(recipientAddress) (32 bytes)
            recipient.substr(2);                    // recipientAddress      (?? bytes)
    
    const bridgeContract = createBridge(tokenAddress, signer);
    try {
      const txDeposit = await bridgeContract.deposit(1, '0x000000000000000000000000000000c76ebe4a02bbc34786d860b355f5a5ce00', data);
      await txDeposit.wait();
      console.log('deposited');
    } catch (e) {
      console.error(e);
    }
    setPending(false);
  }
  
  const subBalance = 10000;

  const isValidAsset = src === 'rinkeby' ? !!accInfo : !!tokenAddress;
  const isValidRecipient = !!recipient;
  const isValidAmount = !!amount && (src === 'rinkeby' ? amount <= accInfo?.allowance && amount <= accInfo.balance : amount <= subBalance);

  const showEthConnectWallet = src === 'rinkeby' && !ethAccount;
  const showEthApprove = src === 'rinkeby' && ethAccount && isValidRecipient && amount > accInfo?.allowance;
  const showEthTransfer = src === 'rinkeby' && ethAccount && !showEthApprove;
  const disableEthTransfer = !ethAccount || !accInfo || !isValidRecipient || !isValidAmount;

  const showSubTransfer = src === 'polkadex';
  const disableSubTransfer = !isValidAsset || !isValidRecipient || !isValidAmount;

  return (
    <Grid.Column width={8} textAlign="center" className="bridge">
      <h1>Bridge</h1>
      <Form>
        <div className="networks">
          <NetworkSelector network={src} label="From" />
          <Button icon='arrows alternate horizontal' className="btn-swtich" onClick={switchNetwork} disabled={pending} />
          <NetworkSelector network={dest} label="To" />
        </div>
        {src === 'rinkeby' && <div className="account-info account-address">
          Your Address: {ethAccount}
        </div>}
        <Form.Field>
          <Input
            fluid
            label='Asset'
            type='text'
            placeholder='Token Address'
            state='tokenAddress'
            value={tokenAddress || ''}
            onChange={onChange}
            disabled={pending}
          />
        </Form.Field>
        {src === 'rinkeby' && <div className="account-info account-balance">
          Your Balance: {accInfo ? accInfo.balance : ''} {loadingAccInfo && <Loader />}
        </div>}
        <Form.Field>
          <Input
            fluid
            label='Recipient'
            type='text'
            placeholder={`${dest.toUpperCase()} Address`}
            state='recipient'
            value={recipient || ''}
            onChange={onChange}
            disabled={pending}
          />
        </Form.Field>
        <Form.Field>
          <Input
            fluid
            label='Amount'
            type='number'
            state='amount'
            value={amount || 0}
            onChange={onChange}
            disabled={pending}
          />
        </Form.Field>
        <Form.Field style={{ textAlign: 'center' }}>
          {showEthConnectWallet && <Button onClick={onConnectWallet}>Connect Wallet</Button>}
          {showEthApprove && <Button onClick={onApprove} loading={pending}>Approve</Button>}
          {showEthTransfer && <Button onClick={onDeposit} loading={pending} disabled={pending || disableEthTransfer}>Confirm Transfer</Button>}
          {showSubTransfer && <TxButton
            accountPair={subAccount}
            label='Confirm Transfer'
            type='SIGNED-TX'
            setStatus={setStatus}
            attrs={{
              palletRpc: 'example',
              callable: 'transferNative',
              inputParams: [tokenAddress, amount, recipient, 0],
              paramFields: [true, true, true, true],
            }}
            disabled={disableSubTransfer}
          />}
        </Form.Field>
        <div style={{ overflowWrap: 'break-word' }}>{status}</div>
        <div>Please wait 3-4 mins after you confirmed the transfer and check your balances on the destination</div>
      </Form>
    </Grid.Column>
  );
}
