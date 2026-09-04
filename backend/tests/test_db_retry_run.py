import asyncio
import unittest
from unittest.mock import AsyncMock, patch
import sqlalchemy.exc


class DummyStudent:
    def __init__(self, id=1, name='Test Student', username='test_lc_user',
                 leetcode_url='https://leetcode.com/test_lc_user', reg_no='20XIT001'):
        self.id = id
        self.name = name
        self.username = username
        self.leetcode_url = leetcode_url
        self.reg_no = reg_no


class TestDBRetryBehavior(unittest.IsolatedAsyncioTestCase):

    async def test_operational_error_triggers_retry(self):
        student = DummyStudent()
        attempt_count = 0

        async def mock_impl_side_effect(*args, **kwargs):
            nonlocal attempt_count
            attempt_count += 1
            if attempt_count == 1:
                raise sqlalchemy.exc.OperationalError('SSL connection closed', None, None)
            return 'SUCCESS'

        with patch('backend.services.canonical_sync_pipeline._sync_single_student_canonical_impl',
                   side_effect=mock_impl_side_effect):
            with patch('asyncio.sleep', new=AsyncMock(return_value=None)):
                from backend.services.canonical_sync_pipeline import _sync_single_student_canonical
                result = await _sync_single_student_canonical(
                    student=student, client=AsyncMock(), sem=asyncio.Semaphore(5),
                    lock=asyncio.Lock(), job_id='TEST', progress_callback=None)
        assert attempt_count == 2, f'Expected 2 attempts, got {attempt_count}'
        assert result == 'SUCCESS'
        print(f'PASS: Retried {attempt_count} times, result={result}')

    async def test_max_retries_raises(self):
        student = DummyStudent(id=2, username='always_failing')
        async def always_fail(*a, **kw):
            raise sqlalchemy.exc.OperationalError('Connection reset', None, None)
        with patch('backend.services.canonical_sync_pipeline._sync_single_student_canonical_impl',
                   side_effect=always_fail):
            with patch('asyncio.sleep', new=AsyncMock(return_value=None)):
                from backend.services.canonical_sync_pipeline import _sync_single_student_canonical
                try:
                    await _sync_single_student_canonical(
                        student=student, client=AsyncMock(), sem=asyncio.Semaphore(5),
                        lock=asyncio.Lock(), job_id='TEST', progress_callback=None)
                    assert False, 'Should have raised'
                except sqlalchemy.exc.OperationalError:
                    print('PASS: Max retries correctly raised OperationalError')

    async def test_non_db_error_does_not_retry(self):
        student = DummyStudent(id=3, username='value_error_user')
        attempt_count = 0
        async def raise_ve(*a, **kw):
            nonlocal attempt_count
            attempt_count += 1
            raise ValueError('Genuine data error - no retry')
        with patch('backend.services.canonical_sync_pipeline._sync_single_student_canonical_impl',
                   side_effect=raise_ve):
            with patch('asyncio.sleep', new=AsyncMock(return_value=None)):
                from backend.services.canonical_sync_pipeline import _sync_single_student_canonical
                try:
                    await _sync_single_student_canonical(
                        student=student, client=AsyncMock(), sem=asyncio.Semaphore(5),
                        lock=asyncio.Lock(), job_id='TEST', progress_callback=None)
                    assert False, 'Should have raised ValueError'
                except ValueError:
                    assert attempt_count == 1, f'Expected 1 attempt, got {attempt_count}'
                    print(f'PASS: ValueError not retried (attempt_count={attempt_count})')

if __name__ == '__main__':
    unittest.main(verbosity=2)
