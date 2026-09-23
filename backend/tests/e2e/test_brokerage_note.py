"""A nota importada é guardada, vira transações ligadas a ela, e importar de novo não duplica.

Entra por HTTP e sem o PDF: a leitura do modelo está coberta pelos testes do
service. O que só o banco responde é a migration das colunas novas, a leitura
das transações do dia e a recusa de uma decisão tomada sobre a carteira velha.
"""

from datetime import date
from http import HTTPStatus

from sqlalchemy import text

PREGAO = '2026-09-01'


def _lines(portfolio_id, broker_id, asset_id) -> dict:
    return {
        'portfolio_id': portfolio_id,
        'lines': [
            {
                'note_index': 0,
                'line_index': index,
                'broker_id': broker_id,
                'asset_id': asset_id,
                'trade_date': PREGAO,
                'settlement_date': '2026-09-03',
                'side': 'C',
                'quantity': quantity,
                'price': 30.0,
                'fees': 0.12,
                'withheld_income_tax': None,
            }
            for index, quantity in enumerate((60, 40))
        ],
    }


async def _groups(client, body) -> list[dict]:
    response = await client.post('/portfolio/brokerage_note/reconciliation', json=body)
    assert response.status_code == HTTPStatus.OK, response.text
    return response.json()


def _note(broker_id) -> dict:
    return {
        'broker_id': broker_id,
        'note_number': '21862',
        'trade_date': PREGAO,
        'settlement_date': '2026-09-03',
        'amounts': {'emoluments': 0.24, 'operations_total': 3000.0, 'net_amount': -3000.24},
    }


def _decisions(groups) -> list[dict]:
    return [
        {'key': g['key'], 'action': g['default_action'], 'existing_ids': g['existing_ids']}
        for g in groups
    ]


async def test_import_creates_lines_with_costs_and_reimport_is_unchanged(client, factory, db):
    portfolio_id = await factory.portfolio()
    broker_id = await factory.broker()
    asset_id = await factory.asset(ticker='PETR4')
    body = _lines(portfolio_id, broker_id, asset_id)

    (group,) = await _groups(client, body)
    assert group['status'] == 'new'

    response = await client.post(
        '/portfolio/brokerage_note',
        json=body | {'note': _note(broker_id), 'decisions': _decisions([group])},
    )
    assert response.status_code == HTTPStatus.OK, response.text
    assert response.json()['created'] == 2

    rows = (
        await db.execute(
            text(
                'SELECT quantity, fees, settlement_date FROM portfolio.transaction '
                'WHERE portfolio_id = :p ORDER BY quantity'
            ),
            {'p': portfolio_id},
        )
    ).all()
    assert [(row.quantity, row.fees, row.settlement_date.isoformat()) for row in rows] == [
        (40.0, 0.12, '2026-09-03'),
        (60.0, 0.12, '2026-09-03'),
    ]

    (again,) = await _groups(client, body)
    assert again['status'] == 'unchanged'

    history = await client.get('/portfolio/brokerage_note', params={'portfolio_id': portfolio_id})
    assert history.status_code == HTTPStatus.OK, history.text
    (note,) = history.json()
    assert (note['note_number'], note['fees'], note['transaction_count']) == ('21862', 0.24, 2)


async def test_a_decision_over_a_portfolio_that_changed_is_refused(client, factory):
    portfolio_id = await factory.portfolio()
    broker_id = await factory.broker()
    asset_id = await factory.asset(ticker='PETR4')
    body = _lines(portfolio_id, broker_id, asset_id)
    groups = await _groups(client, body)

    # Entre a leitura e a confirmação, a operação foi lançada à mão.
    await factory.transaction(
        portfolio_id=portfolio_id,
        asset_id=asset_id,
        broker_id=broker_id,
        quantity=100,
        on=date(2026, 9, 1),
    )

    response = await client.post(
        '/portfolio/brokerage_note',
        json=body | {'note': _note(broker_id), 'decisions': _decisions(groups)},
    )

    assert response.status_code == HTTPStatus.CONFLICT
