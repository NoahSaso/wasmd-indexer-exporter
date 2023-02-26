import request from 'supertest'

import { Account, AccountCodeIdSet, AccountWebhook } from '@/db'
import { getAccountWithAuth } from '@/test/utils'

import { app } from './app'

describe('POST /webhooks', () => {
  let account: Account
  let token: string
  let codeIdSet: AccountCodeIdSet
  beforeEach(async () => {
    const { account: _account, token: _token } = await getAccountWithAuth()

    account = _account
    token = _token

    codeIdSet = await account.$create('codeIdSet', {
      name: 'contract',
      codeIds: [1, 50, 200],
    })
  })

  it('returns error if no auth token', async () => {
    await request(app.callback())
      .post('/webhooks')
      .send({})
      .expect(401)
      .expect('Content-Type', /json/)
      .expect({
        error: 'No token.',
      })
  })

  it('returns error if description too long', async () => {
    await request(app.callback())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'd'.repeat(256),
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .expect({
        error: 'Description too long.',
      })
  })

  it('allows empty descriptions', async () => {
    for (const description of [undefined, null, '', ' ']) {
      const response = await request(app.callback())
        .post('/webhooks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...(description !== undefined
            ? {
                description,
              }
            : {}),
        })
        .expect('Content-Type', /json/)

      expect(response.body.error).not.toBe('Description too long.')
    }
  })

  it('returns error if no URL', async () => {
    await request(app.callback())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(400)
      .expect('Content-Type', /json/)
      .expect({
        error: 'Invalid URL.',
      })
  })

  it('returns error if empty URL', async () => {
    await request(app.callback())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        url: '',
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .expect({
        error: 'Invalid URL.',
      })
  })

  it('returns error if invalid URL', async () => {
    for (const url of ['not_a_url', 'http://', 'https://', 'not_a_url.com']) {
      await request(app.callback())
        .post('/webhooks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          url,
        })
        .expect(400)
        .expect('Content-Type', /json/)
        .expect({
          error: 'Invalid URL.',
        })
    }
  })

  it('returns error if no filters', async () => {
    await request(app.callback())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'test',
        url: 'https://example.com',
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .expect({
        error: 'At least one filter is required.',
      })
  })

  it('validates code ID sets', async () => {
    await Promise.all(
      [[3], [3, codeIdSet.id]].map(async (codeIdSetIds) => {
        await request(app.callback())
          .post('/webhooks')
          .set('Authorization', `Bearer ${token}`)
          .send({
            description: 'test',
            url: 'https://example.com',
            codeIdSetIds,
          })
          .expect(400)
          .expect('Content-Type', /json/)
          .expect({
            error: 'Invalid code ID sets.',
          })
      })
    )

    const response = await request(app.callback())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'test',
        url: 'https://example.com',
        codeIdSetIds: [codeIdSet.id],
      })
    expect(response.body.error).not.toBe('Invalid code ID sets.')
  })

  it('validates contract addresses', async () => {
    await Promise.all(
      ['not_an_array', [1], [1, 'address']].map(async (contractAddresses) => {
        await request(app.callback())
          .post('/webhooks')
          .set('Authorization', `Bearer ${token}`)
          .send({
            description: 'test',
            url: 'https://example.com',
            contractAddresses,
          })
          .expect(400)
          .expect('Content-Type', /json/)
          .expect({
            error: 'Invalid contract addresses.',
          })
      })
    )

    const response = await request(app.callback())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'test',
        url: 'https://example.com',
        contractAddresses: ['address'],
      })
    expect(response.body.error).not.toBe('Invalid contract addresses.')
  })

  it('validates state key', async () => {
    await request(app.callback())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'test',
        url: 'https://example.com',
        stateKey: 1,
      })
      .expect(400)
      .expect('Content-Type', /json/)
      .expect({
        error: 'Invalid state key.',
      })

    // Valid state keys.
    await Promise.all(
      [undefined, null, ' ', 'stateKey'].map(async (stateKey) => {
        const response = await request(app.callback())
          .post('/webhooks')
          .set('Authorization', `Bearer ${token}`)
          .send({
            description: 'test',
            url: 'https://example.com',
            stateKey,
          })
        expect(response.body.error).not.toBe('Invalid state key.')
      })
    )
  })

  it('does not create webhook if no auth token', async () => {
    const initialWebhooks = await AccountWebhook.count()

    await request(app.callback())
      .post('/webhooks')
      .send({
        description: 'test',
        url: 'https://example.com',
        stateKey: 'stateKey',
      })
      .expect(401)

    // Verify webhook not created.
    expect(await AccountWebhook.count()).toBe(initialWebhooks)
  })

  it('creates a new webhook', async () => {
    const initialWebhooks = await AccountWebhook.count()

    await request(app.callback())
      .post('/webhooks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'test',
        url: 'https://example.com',
        codeIdSetIds: [codeIdSet.id],
        contractAddresses: ['junoContract1', 'junoContract2'],
        stateKey: 'stateKey',
        stateKeyIsPrefix: false,
      })
      .expect(201)

    // Verify webhook was created correctly.
    expect(await AccountWebhook.count()).toBe(initialWebhooks + 1)

    const webhook = await AccountWebhook.findOne({
      include: AccountCodeIdSet,
    })
    expect(webhook).not.toBeNull()
    expect(webhook!.accountPublicKey).toBe(account.publicKey)
    expect(webhook!.description).toBe('test')
    expect(webhook!.url).toBe('https://example.com')
    expect(webhook!.codeIdSets.length).toBe(1)
    expect(webhook!.codeIdSets[0].id).toBe(codeIdSet.id)
  })
})
