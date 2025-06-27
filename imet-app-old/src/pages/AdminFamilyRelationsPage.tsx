// src/pages/AdminFamilyRelationsPage.tsx
import React, { useState } from 'react';
import { Box, Typography, MenuItem, Select, InputLabel, FormControl } from '@mui/material';
import { useUsers } from '../hooks/useUsers';
import { FamilyRelationsDialog } from '../components/FamilyRelationsDialog';

const AdminFamilyRelationsPage: React.FC = () => {
  const { users } = useUsers();
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Relations familiales</Typography>

      <FormControl fullWidth margin="normal">
        <InputLabel>Choisir un utilisateur</InputLabel>
        <Select
          value={selectedUserId}
          label="Choisir un utilisateur"
          onChange={(e) => setSelectedUserId(e.target.value)}
        >
          {users.map((user) => (
            <MenuItem key={user.id} value={user.id}>
              {user.full_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedUserId && 
        <FamilyRelationsDialog
          userId={selectedUserId}
          userName={users.find(u => u.id === selectedUserId)?.full_name || ''}
          open={true}
          onClose={() => setSelectedUserId('')}
        />
      }
    </Box>
  );
};

export default AdminFamilyRelationsPage;
