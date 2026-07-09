from django.test import TestCase


class LoginPageTests(TestCase):
    def test_login_page_renders(self):
        response = self.client.get('/login')

        self.assertEqual(response.status_code, 200)
        self.assertIn(b'/api/auth/login', response.content)
        self.assertIn(b'/api/auth/me', response.content)
