import React from 'react';
import { Grid } from 'semantic-ui-react';
import './NetworkSelector.css'

export default function Main ({ network, label }) {

    const networks = {
        'rinkeby': {
            icon: `${process.env.PUBLIC_URL}/assets/ethereum.png`,
            label: 'Ethereum Network (Rinkeby)'
        },
        'polkadex': {
            icon: `${process.env.PUBLIC_URL}/assets/polkadex.png`,
            label: 'Polkadex Network (Testnet)'
        }
    }
    return (
        <div className="network-selector-container">
            <label>{label}</label>
            <div className="network-selector">
                <div className="network-selector-icon">
                    <img src={networks[network].icon} />
                </div>
                <div className="network-selector-switcher">
                    {networks[network].label}
                </div>
            </div>
        </div>
    );
}
