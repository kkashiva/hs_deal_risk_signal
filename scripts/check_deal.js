const { Client } = require('@hubspot/api-client');
const client = new Client({ accessToken: process.env.HUBSPOT_ACCESS_TOKEN });

async function check() {
    try {
        const response = await client.crm.deals.basicApi.getById('55566285497', ['hs_v2_time_in_current_stage', 'hs_mrr', 'amount']);
        console.log('Deal Data:', JSON.stringify(response.properties, null, 2));
    } catch (e) {
        console.error(e);
    }
}
check();
