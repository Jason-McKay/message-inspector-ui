'use strict';

/**
 * Seed data for the mock backend. Everything here is cloned into mutable state on
 * startup and on every "Reset fixtures", so handlers can delete and move messages
 * freely without permanently damaging the seed.
 *
 * The payloads are deliberately varied: JSON, XML, plain text and one deliberately
 * malformed JSON body, because MessageDetailComponent renders them through the
 * `prettyPayload` pipe and each of those takes a different branch through it.
 */

/** Users mirror the backend's in-memory store (security/UserConfig.java). */
const USERS = [
  { username: 'admin', password: 'admin', roles: ['ADMIN'] },
  { username: 'jason', password: 'jason', roles: ['USER'] },
];

/**
 * `activemq.management::orders` carries the `::` that becomes %3A%3A on the wire. It is
 * here on purpose: it is the shape of name that exposed the double-encoding bug, so the
 * fixture set should always contain one.
 */
const QUEUES = [
  'orders.inbound',
  'orders.outbound',
  'payments.pending',
  'activemq.management::orders',
  'ExpiryQueue',
  'DLQ',
];

const MESSAGES = {
  'orders.inbound': [
    message('ID:a1f3c8de-0001-4c2a-9f11-9b2d6e4a7c01', 'orders.inbound',
      '2026-08-27T09:14:22.113Z',
      JSON.stringify({ orderId: 'SO-88213', customer: 'Northwind Ltd', total: 1249.99, currency: 'EUR', lines: 3 }, null, 0),
      { JMSPriority: '4', JMSDeliveryMode: 'PERSISTENT', 'x-source': 'checkout-api' }),
    message('ID:a1f3c8de-0002-4c2a-9f11-9b2d6e4a7c02', 'orders.inbound',
      '2026-08-27T09:15:03.882Z',
      '<order><id>SO-88214</id><customer>Acme GmbH</customer><total currency="EUR">87.40</total></order>',
      { JMSPriority: '4', JMSDeliveryMode: 'PERSISTENT', 'x-source': 'edi-gateway' }),
    message('ID:a1f3c8de-0003-4c2a-9f11-9b2d6e4a7c03', 'orders.inbound',
      '2026-08-27T09:22:47.500Z',
      'ORDER|SO-88215|Contoso|412.00|EUR|2026-08-27',
      { JMSPriority: '9', JMSDeliveryMode: 'NON_PERSISTENT', 'x-source': 'legacy-batch' }),
    message('ID:a1f3c8de-0004-4c2a-9f11-9b2d6e4a7c04', 'orders.inbound',
      '2026-08-27T10:02:11.007Z',
      '{"orderId":"SO-88216","customer":"Fabrikam","total":',
      { JMSPriority: '4', JMSDeliveryMode: 'PERSISTENT', 'x-source': 'checkout-api', 'x-truncated': 'true' }),
  ],
  'orders.outbound': [
    message('ID:b7e2d411-0001-41aa-8c30-5d1f9c2e8a10', 'orders.outbound',
      '2026-08-27T11:41:09.221Z',
      JSON.stringify({ orderId: 'SO-88201', status: 'CONFIRMED', warehouse: 'AMS-2' }, null, 0),
      { JMSPriority: '4', JMSDeliveryMode: 'PERSISTENT' }),
  ],
  'payments.pending': [
    message('ID:c3d90a55-0001-4f7b-b2e6-1a4c7d9e5b21', 'payments.pending',
      '2026-08-28T06:03:55.664Z',
      JSON.stringify({ paymentId: 'PAY-4471', orderId: 'SO-88213', amount: 1249.99, method: 'SEPA' }, null, 0),
      { JMSPriority: '4', JMSDeliveryMode: 'PERSISTENT', 'x-retry-count': '2' }),
    message('ID:c3d90a55-0002-4f7b-b2e6-1a4c7d9e5b22', 'payments.pending',
      '2026-08-28T06:11:30.019Z',
      JSON.stringify({ paymentId: 'PAY-4472', orderId: 'SO-88214', amount: 87.4, method: 'CARD' }, null, 0),
      { JMSPriority: '4', JMSDeliveryMode: 'PERSISTENT', 'x-retry-count': '0' }),
  ],
  'activemq.management::orders': [
    message('ID:d5511e07-0001-4b18-9a77-2f6b3c1d8e30', 'activemq.management::orders',
      '2026-08-28T07:00:00.000Z',
      JSON.stringify({ operation: 'listQueues', broker: '0.0.0.0' }, null, 0),
      { JMSPriority: '4' }),
  ],
  ExpiryQueue: [],
  DLQ: [
    message('ID:e9004b22-0001-4d5c-8e91-7c2a1f6b4d40', 'DLQ',
      '2026-08-26T22:47:18.775Z',
      JSON.stringify({ orderId: 'SO-88190', error: 'InventoryUnavailable', attempts: 5 }, null, 0),
      { JMSPriority: '4', JMSDeliveryMode: 'PERSISTENT', _AMQ_ORIG_QUEUE: 'orders.inbound' }),
  ],
};

/** Matches the backend's JmsMessageDto field-for-field, `queueName` included. */
function message(messageId, queueName, timestamp, payload, properties) {
  return { messageId, payload, queueName, timestamp, properties };
}

module.exports = { USERS, QUEUES, MESSAGES };
