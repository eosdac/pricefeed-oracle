require('./config.js');

const fetch = require('node-fetch');
const { Api, JsonRpc, RpcError } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');


function get_api(){
    const signatureProvider = new JsSignatureProvider([EOS_KEY]);
    const rpc = new JsonRpc( EOS_PROTOCOL + "://" + EOS_HOST + ":" + EOS_PORT, { fetch });

    const api = new Api({
        rpc,
        signatureProvider,
        textDecoder: new TextDecoder(),
        textEncoder: new TextEncoder()
    });

    return api;
}

async function get_price(currency = 'USD'){
    const res = await fetch(`${API_URL}?key=${API_KEY}&ids=EOS&interval=1d&convert=${currency}`);
    const data = (await res.json())[0];
    if (!data || !data.id){
        throw new Error(`Invalid data from API`);
    }
    if (data.id != 'EOS'){
        throw new Error(`Invalid id from API ${data.id}`);
    }

    const price = parseFloat(data.price);
    if (!price || isNaN(price)){
        throw new Error(`Invalid price received from API ${data.price}`);
    }

    return price;
}

async function get_quote_data(currency){
    const price = await get_price(currency);
    const pair = `eos${currency}`.toLowerCase();
    return {"value": parseInt(Math.round(price * 10000)), pair};
}

async function get_action(currencies = ['USD', 'GBP', 'CNY']){
    const promises = [];
    currencies.forEach((currency) => {
        promises.push(get_quote_data(currency));
    });

    const quotes = await Promise.all(promises);

    return {
        account: CONTRACT,
        name: 'write',
        authorization: [{
            actor: ORACLE,
            permission: ORACLE_PERMISSION
        }],
        data: {
            owner: ORACLE,
            quotes
        },
    };
}

async function write() {
    const eos = get_api();

    try {
        const actions = [ await get_action(CURRENCIES) ];

        const res = await eos.transact({
            actions
        }, { blocksBehind: 3, expireSeconds: 30 });

        console.log(`Feed published for ${CURRENCIES.join(', ')} with txid : ${res.transaction_id}`);
    }
    catch (e){
        console.error(`ERROR : ${e.message}`, e);
    }
}


write();

setInterval(write, FREQ);
