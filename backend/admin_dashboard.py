from flask import Flask, jsonify, request, render_template_string
from models.user import User

app = Flask(__name__)

# Simple HTML template for dashboard
DASHBOARD_HTML = """
<!DOCTYPE html>
<html>
<head>
    <title>Admin Dashboard - User Management</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f9f9f9; }
        h2 { color: #333; }
        table { border-collapse: collapse; width: 100%; background: #fff; }
        th, td { border: 1px solid #ccc; padding: 10px; text-align: left; }
        th { background: #eee; }
        button { padding: 6px 12px; margin: 0 2px; }
        .enabled { color: green; font-weight: bold; }
        .disabled { color: red; font-weight: bold; }
    </style>
</head>
<body>
    <h2>User Management</h2>
    <table id="users-table">
        <thead>
            <tr>
                <th>First Name</th><th>Last Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th>
            </tr>
        </thead>
        <tbody></tbody>
    </table>
    <script>
        function fetchUsers() {
            fetch('/api/users')
                .then(res => res.json())
                .then(data => {
                    const tbody = document.querySelector('#users-table tbody');
                    tbody.innerHTML = '';
                    data.forEach(user => {
                        const status = user.is_disabled ? 
                            '<span class="disabled">Disabled</span>' : 
                            '<span class="enabled">Enabled</span>';
                        const actionBtn = user.is_disabled ?
                            `<button onclick="enableUser('${user.uid}')">Enable</button>` :
                            `<button onclick="disableUser('${user.uid}')">Disable</button>`;
                        tbody.innerHTML += `
                            <tr>
                                <td>${user.first_name}</td>
                                <td>${user.last_name}</td>
                                <td>${user.email}</td>
                                <td>${user.role}</td>
                                <td>${status}</td>
                                <td>${actionBtn}</td>
                            </tr>
                        `;
                    });
                });
        }
        function enableUser(uid) {
            fetch('/api/users/' + uid + '/enable', {method: 'POST'})
                .then(() => fetchUsers());
        }
        function disableUser(uid) {
            fetch('/api/users/' + uid + '/disable', {method: 'POST'})
                .then(() => fetchUsers());
        }
        fetchUsers();
    </script>
</body>
</html>
"""

@app.route('/')
def dashboard():
    return render_template_string(DASHBOARD_HTML)

@app.route('/api/users')
def get_users():
    users = User.get_all_users()
    return jsonify([user.to_safe_dict() for user in users])

@app.route('/api/users/<uid>/enable', methods=['POST'])
def enable_user(uid):
    success = User.enable_user_by_uid(uid)
    return jsonify({'success': success})

@app.route('/api/users/<uid>/disable', methods=['POST'])
def disable_user(uid):
    success = User.disable_user_by_uid(uid)
    return jsonify({'success': success})

if __name__ == '__main__':
    app.run(debug=False)
