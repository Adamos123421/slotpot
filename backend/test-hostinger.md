# Testing Your Hostinger Deployment

## After Deployment:

### 1. Check if service is running:
```bash
pm2 status
pm2 logs slotpot-backend
```

### 2. Test API endpoints:
```bash
# Test admin status
curl http://your-vps-ip:5002/api/admin/status

# Test from outside
curl http://your-domain.com:5002/api/admin/status
```

### 3. Check logs:
```bash
pm2 logs slotpot-backend --lines 50
```

### 4. Restart if needed:
```bash
pm2 restart slotpot-backend
```

## Common Issues:

1. **Port not accessible**: Check firewall settings
2. **Environment variables**: Make sure .env is configured
3. **Dependencies**: Run `npm install` if modules missing
4. **Permissions**: Use `sudo` for system operations

## Domain Setup:
If you have a domain, configure it to point to your VPS IP and use a reverse proxy (nginx) for better performance. 