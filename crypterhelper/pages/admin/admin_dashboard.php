<?php
session_start();
include '../../includes/db.php'; // Database connection

// If the user is not logged in or not an admin, redirect to login page
if (!isset($_SESSION['user_id']) || $_SESSION['role'] !== 'admin') {
    header("Location: ../error.php");
    exit;
}

$user_id = $_SESSION['user_id'];

// Fetch admin details from the database
$query = "SELECT * FROM users WHERE id = ?";
$stmt = $pdo->prepare($query);
$stmt->execute([$user_id]);
$user = $stmt->fetch();

// Check if the user exists
//TheBigFox123@@
//aQMiLBb9OcSr8qY2sU159p6rpeEEA+Gm70EmPjlxQyU=
//aQMiLBb9OcSr8qY2sU159p6rpeEEA+Gm70EmPjlxQyU=
if (!$user) {
    header("Location: error.php");
    exit;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Admin Dashboard - CrypterHelper</title>
    <style>
        body { 
            font-family: Arial, 
            sans-serif; 
            margin: 0; 
            padding: 0; 
            background-color: #f9f9f9; 
        }
        header { 
            background-color: #004466; 
            color: white; 
            text-align: left; 
            padding: 1rem 2rem; 
            display: flex; 
            justify-content: space-between;
            align-items: center;
        }
        header h1 { 
            margin: 0; 
        }
        .logout-btn {
            background-color: #004466; 
            color: white; 
            padding: 10px 20px; 
            border: 2px solid white; 
            cursor: pointer; 
            border-radius: 5px; 
            text-decoration: none;
            box-sizing: border-box;
            transition: background-color 0.3s;
        }
        .logout-btn:hover { 
            background-color: #003355; 
        }
        footer {
            background-color: #004466; 
            color: white; 
            text-align: center; 
            padding: 1rem 0;
        }
        .container { 
            width: 80%; 
            margin: 2rem auto; 
        }
        h2 { 
            margin-bottom: 1rem; 
        }
        .section { 
            margin-bottom: 2rem; 
            padding: 1rem; 
            background-color: #fff; 
            border-radius: 8px; 
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); 
        }
        .btn { 
            padding: 10px 15px; 
            background-color: #004466; 
            color: white; 
            border: none; 
            cursor: pointer; 
            border-radius: 5px; 
            text-decoration: none; 
        }
        .btn:hover { 
            background-color: #003355; 
        }
        .account-info p { 
            margin: 10px 0; 
        }
        .account-info a { 
            margin-right: 10px; 
        }
    </style>
</head>
<body>

<header>
    <h1>CrypterHelper Admin Dashboard</h1>
    <a href="../authentication/logout.php" class="logout-btn">Logout</a>
</header>

<div class="container">
    <section class="section account-info">
        <h2>Admin Account Information</h2>
        <p><strong>Username:</strong> <?php echo htmlspecialchars($user['username']); ?></p>
        <p><strong>Email:</strong> <?php echo htmlspecialchars($user['email']); ?></p>
    </section>

    <section class="section manage-users">
        <h2>Manage Users</h2>
        <p>View and manage all users of the platform.</p>
        <a href="manage_users.php" class="btn">Manage Users</a>
    </section>

    <section class="section support-tickets">
        <h2>Support Tickets</h2>
        <p>View all support tickets raised by users.</p>
        <a href="admin_tickets.php" class="btn">View Tickets</a>
    </section>

    <section class="section audit">
        <h2>Generate Audit Report and Logs</h2>
        <p>Generate a list of audit report and logs for audit check</p>
        <a href="audit.php" class="btn">Generate Audit</a>
    </section>

    <section class="section logs">
        <h2>Security & Compliance Monitoring</h2>
        <p>View user activity logs</p>
        <p>Monitor file uploads and downloads</p>
        <p>Check encryption key generation</p>
        <p>Check integrity of files</p>
        <a href="logs.php" class="btn">View Logs</a>
    </section>

    <section class="section educational-material">
        <h2>Educational Material Updates</h2>
        <p>Update and upload new information for security guidelines and key management</p>
        <a href="update_em.php" class="btn">Update Educational Material</a>
    </section>

    <section class="section app-update">
        <h2>Application Updates</h2>
        <p>Upload a new version of the application for users to download.</p>
        <a href="update_app.php" class="btn">Update Application</a>
    </section>
</div>

<footer>
    <p>© 2025 CrypterHelper. All rights reserved.</p>
</footer>

</body>
</html>
