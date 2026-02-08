
import { NextResponse } from 'next/server';

export async function GET() {
    const apiKey = process.env.NEXT_CMC_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'CMC API Key not configured' }, { status: 500 });
    }
    
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=500';

    // This maps CMC's platform names to our internal network IDs
    const platformNameToNetworkId: { [key: string]: string } = {
        'ethereum': '1', 
        'polygon': '137', 
        'optimism': '10', 
        'bnb smart chain (bep20)': '56',
        'bnb smart chain': '56', 
        'arbitrum': '42161', 
        'arbitrum one': '42161', 
        'base': '8453',
        'avalanche c-chain': '43114', 
        'avalanche': '43114'
    };

    try {
        const response = await fetch(url, {
            headers: {
                'X-CMC_PRO_API_KEY': apiKey,
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('CMC API Error:', errorData);
            return NextResponse.json({ error: 'Failed to fetch token data from CMC' }, { status: response.status });
        }

        const data = await response.json();
        
        const tokens = data.data
            .map((token: any) => {
                const platformName = token.platform?.name?.toLowerCase();
                const networkId = platformName ? platformNameToNetworkId[platformName] : null;
                
                return {
                    name: token.name,
                    symbol: token.symbol,
                    price: token.quote.USD.price,
                    address: token.platform?.token_address,
                    networkId: networkId,
                }
            });

        return NextResponse.json(tokens);
    } catch (error) {
        console.error('Error in /api/tokens:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

    