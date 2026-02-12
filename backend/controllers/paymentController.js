const { createRequest, getRequest, markPaid, getAllRequests, deleteRequest } = require('../lib/store');
const { verifyTransaction } = require('../lib/blockchain');
const { create402Response } = require('../lib/x402');
const { getTokenAddress, isNativeToken, getCanonicalName } = require('../lib/chainRegistry');

exports.createPaymentRequest = async (req, res) => {
    try {
        const { token, amount, receiver, payer, description, network, expiresInDays, creatorWallet } = req.body;

        if (!token || !amount || !receiver) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const request = await createRequest({
            token,
            amount,
            receiver,
            payer,
            description,
            network: network || 'sepolia',
            expiresInDays,
            creatorWallet
        });

        console.log('✅ REQUEST CREATED:', request.id);

        return res.status(201).json({
            success: true,
            request: {
                id: request.id,
                link: `/r/${request.id}`
            }
        });
    } catch (error) {
        console.error('Error creating payment request:', error);
        return res.status(500).json({ error: 'Failed to create payment request' });
    }
};

exports.processLcxPayment = async (req, res) => {
    try {
        const { requestId, lcxUserId } = req.body;

        if (!requestId || !lcxUserId) {
            return res.status(400).json({ error: 'Missing requestId or lcxUserId' });
        }

        const request = await getRequest(requestId);

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status === 'PAID') {
            return res.status(400).json({ error: 'Request already paid' });
        }

        // Simulation logic
        await new Promise(resolve => setTimeout(resolve, 1000));

        const simulatedTxHash = '0xLCX' + Math.random().toString(36).substr(2, 40);
        const updatedRequest = await markPaid(requestId, simulatedTxHash);

        return res.status(200).json({
            success: true,
            status: 'PAID',
            message: 'Payment processed via LCX (simulated)',
            request: updatedRequest,
            txHash: simulatedTxHash
        });
    } catch (error) {
        console.error('Error processing LCX payment:', error);
        return res.status(500).json({ error: 'Failed to process payment' });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const { requestId, txHash } = req.body;

        if (!requestId || !txHash) {
            return res.status(400).json({ error: 'Missing requestId or txHash' });
        }

        const request = await getRequest(requestId);

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        if (request.status === 'PAID') {
            return res.status(400).json({ error: 'Request already paid' });
        }

        // Determine token address via chain registry
        const tokenSymbol = request.token?.toUpperCase() || 'USDC';
        const network = getCanonicalName(request.network || 'sepolia') || 'sepolia';
        const tokenAddress = isNativeToken(tokenSymbol, network) ? null : getTokenAddress(network, tokenSymbol);

        const verification = await verifyTransaction(
            txHash,
            request.amount,
            tokenAddress,
            request.receiver,
            tokenSymbol,
            network  // Pass network for proper RPC selection
        );

        if (!verification.valid) {
            return res.status(400).json({
                error: 'Payment verification failed',
                details: verification.error
            });
        }

        const updatedRequest = await markPaid(requestId, txHash);

        return res.status(200).json({
            success: true,
            status: 'PAID',
            request: updatedRequest,
            verification
        });
    } catch (error) {
        console.error('Error verifying payment:', error);
        return res.status(500).json({ error: 'Failed to verify payment' });
    }
};

exports.getPaymentRequest = async (req, res) => {
    try {
        const { id } = req.params;

        console.log('🔍 LOOKING FOR REQUEST:', id);

        const request = await getRequest(id);

        if (!request) {
            console.log('❌ REQUEST NOT FOUND');
            return res.status(404).json({ error: 'Payment request not found' });
        }

        console.log('✅ REQUEST FOUND:', request);

        if (request.expiresAt && Date.now() > request.expiresAt) {
            return res.status(410).json({ error: 'Payment request expired' });
        }

        if (request.status === 'PAID') {
            return res.status(200).json({
                success: true,
                status: 'PAID',
                request: {
                    id: request.id,
                    amount: request.amount,
                    token: request.token,
                    receiver: request.receiver,
                    network: request.network,
                    description: request.description,
                    txHash: request.txHash,
                    paidAt: request.paidAt
                }
            });
        }

        const response402 = create402Response(request);

        Object.entries(response402.headers).forEach(([key, value]) => {
            res.setHeader(key, value);
        });

        return res.status(402).json(response402.body);
    } catch (error) {
        console.error('Error getting payment request:', error);
        return res.status(500).json({ error: 'Failed to get payment request' });
    }
};

// New: Get all payment requests
exports.getAllPaymentRequests = async (req, res) => {
    try {
        const { wallet } = req.query;
        
        const requests = await getAllRequests(wallet || null);

        // Add computed fields
        const enrichedRequests = requests.map(request => ({
            ...request,
            isExpired: request.expiresAt ? Date.now() > request.expiresAt : false,
            isPaid: request.status === 'PAID'
        }));

        return res.status(200).json({
            success: true,
            requests: enrichedRequests,
            count: enrichedRequests.length
        });
    } catch (error) {
        console.error('Error getting all payment requests:', error);
        return res.status(500).json({ error: 'Failed to get payment requests' });
    }
};

// New: Delete payment request
exports.deletePaymentRequest = async (req, res) => {
    try {
        const { id } = req.params;

        const request = await getRequest(id);

        if (!request) {
            return res.status(404).json({ error: 'Payment request not found' });
        }

        await deleteRequest(id);

        console.log('🗑️ REQUEST DELETED:', id);

        return res.status(200).json({
            success: true,
            message: 'Payment request deleted successfully',
            id
        });
    } catch (error) {
        console.error('Error deleting payment request:', error);
        return res.status(500).json({ error: 'Failed to delete payment request' });
    }
};
