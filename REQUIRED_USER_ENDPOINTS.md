# 📋 ENDPOINTS REQUERIDOS EN MS-NEXUS-USER

## 🎯 Para completar el procesamiento de volúmenes semanales

Los siguientes endpoints NATS necesitan ser implementados en **ms-nexus-user** para que el corte semanal funcione completamente:

---

### **1. `user.getUserWithChildren`** 
**Reemplaza**: Acceso directo a entidades `leftChild` y `rightChild`

```typescript
// Input
{ userId: string }

// Output  
{
  id: string;
  referralCode: string;
  leftChildId?: string;    // ID del hijo izquierdo directo
  rightChildId?: string;   // ID del hijo derecho directo
}

// Equivalente SQL del monolito:
// SELECT u.id, u.referral_code, lc.id as left_child_id, rc.id as right_child_id
// FROM users u  
// LEFT JOIN users lc ON u.left_child_id = lc.id
// LEFT JOIN users rc ON u.right_child_id = rc.id
// WHERE u.id = $1
```

---

### **2. `user.tree.getDescendantsInLeg`**
**Reemplaza**: Query SQL recursivo `WITH RECURSIVE descendants`

```typescript
// Input
{ 
  userId: string,      // El hijo raíz de la pierna
  side: 'LEFT' | 'RIGHT'  // Lado de la pierna
}

// Output
string[]  // Array de IDs de todos los descendientes

// Equivalente SQL del monolito:
// WITH RECURSIVE descendants AS (
//   SELECT id FROM users WHERE id = $1
//   UNION ALL
//   SELECT u.id FROM users u
//   JOIN descendants d ON u.parent_id = d.id
// )
// SELECT id FROM descendants;
```

---

### **3. `user.tree.checkActiveMembershipsInLeg`** 
**Reemplaza**: Join con tabla memberships para verificar activos

```typescript
// Input
{
  descendantIds: string[];  // IDs de descendientes
  referralCode: string;     // Código de referencia del usuario padre
}

// Output  
boolean  // true si hay al menos una membresía activa

// Equivalente SQL del monolito:
// SELECT COUNT(*) as count
// FROM users u
// JOIN memberships m ON m.user_id = u.id
// WHERE u.id = ANY($1) 
//   AND u.referrer_code = $2
//   AND m.status = 'ACTIVE';
// 
// return count > 0
```

---

## 🔧 **Implementación Sugerida**

### **En ms-nexus-user controller:**
```typescript
@MessagePattern({ cmd: 'user.getUserWithChildren' })
async getUserWithChildren(@Payload() data: { userId: string }) {
  return this.userService.getUserWithChildren(data.userId);
}

@MessagePattern({ cmd: 'user.tree.getDescendantsInLeg' })
async getDescendantsInLeg(@Payload() data: { userId: string, side: 'LEFT' | 'RIGHT' }) {
  return this.userService.getDescendantsInLeg(data.userId, data.side);
}

@MessagePattern({ cmd: 'user.tree.checkActiveMembershipsInLeg' })
async checkActiveMembershipsInLeg(@Payload() data: { descendantIds: string[], referralCode: string }) {
  return this.userService.checkActiveMembershipsInLeg(data.descendantIds, data.referralCode);
}
```

---

## ⚠️ **Notas Importantes**

1. **Performance**: El query recursivo puede ser costoso. Considera indexar `parent_id` y `referrer_code`.

2. **Cache**: Los descendientes cambian poco. Se puede cachear por períodos cortos.

3. **Batch**: `checkActiveMembershipsInLeg` debe manejar arrays grandes de `descendantIds`.

4. **Integración con ms-nexus-membership**: El endpoint necesita comunicarse con el servicio de membresías para verificar status `ACTIVE`.

---

## 🎯 **Una vez implementados estos endpoints:**

El corte de volúmenes semanales funcionará **100% idéntico al monolito**, procesando:
- ✅ Verificación real de piernas MLM
- ✅ Validación de membresías activas en descendientes  
- ✅ Cálculo correcto de comisiones binarias
- ✅ Manejo apropiado de carry-over por piernas