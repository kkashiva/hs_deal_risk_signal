const { Client } = require('@hubspot/api-client');
const client = new Client({ accessToken: 'pat-na1-79fca4c8-7b36-462a-9f34-ba2adfd031a0' });

async function check() {
    try {
        const response = await client.crm.deals.basicApi.getById('55566285497', ['hs_v2_time_in_current_stage', 'hs_mrr', 'amount']);
        console.log('Deal Data:', JSON.stringify(response.properties, null, 2));
    } catch (e) {
        console.error(e);
    }
}
check();
