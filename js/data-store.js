(function () {
  const KEYS = {
    designs: "ajartivo_designs",
    users: "ajartivo_users",
    payments: "ajartivo_payments"
  };

  function read(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch (error) {
      return [];
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uid(prefix) {
    return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
  }

  function seed() {
    if (read(KEYS.designs).length === 0) {
      write(KEYS.designs, [
        {
          id: uid("dsn"),
          name: "Wedding Flex Banner",
          category: "PSD",
          price: 499,
          description: "Editable wedding template",
          previewUrl: "",
          downloadUrl: "",
          createdAt: new Date().toISOString()
        }
      ]);
    }

    if (read(KEYS.users).length === 0) {
      write(KEYS.users, [
        {
          id: uid("usr"),
          name: "Anand Singh",
          email: "admin@ajartivo.com",
          role: "Super Admin",
          status: "Active",
          createdAt: new Date().toISOString()
        }
      ]);
    }

    if (read(KEYS.payments).length === 0) {
      write(KEYS.payments, [
        {
          id: uid("pay"),
          payer: "Starter Customer",
          amount: 499,
          method: "UPI",
          status: "Paid",
          createdAt: new Date().toISOString()
        }
      ]);
    }
  }

  const DataStore = {
    getDesigns: function () {
      return read(KEYS.designs);
    },
    getDesignById: function (id) {
      return (
        read(KEYS.designs).find(function (item) {
          return item.id === id;
        }) || null
      );
    },
    addDesign: function (design) {
      const items = read(KEYS.designs);
      items.unshift({
        id: uid("dsn"),
        createdAt: new Date().toISOString(),
        ...design
      });
      write(KEYS.designs, items);
      return items;
    },
    updateDesign: function (id, patch) {
      const items = read(KEYS.designs).map(function (item) {
        if (item.id !== id) {
          return item;
        }

        return {
          ...item,
          ...patch,
          updatedAt: new Date().toISOString()
        };
      });

      write(KEYS.designs, items);
      return items;
    },
    deleteDesign: function (id) {
      const items = read(KEYS.designs).filter(function (item) {
        return item.id !== id;
      });
      write(KEYS.designs, items);
      return items;
    },
    getUsers: function () {
      return read(KEYS.users);
    },
    addUser: function (user) {
      const items = read(KEYS.users);
      items.unshift({
        id: uid("usr"),
        createdAt: new Date().toISOString(),
        ...user
      });
      write(KEYS.users, items);
      return items;
    },
    deleteUser: function (id) {
      const items = read(KEYS.users).filter(function (item) {
        return item.id !== id;
      });
      write(KEYS.users, items);
      return items;
    },
    getPayments: function () {
      return read(KEYS.payments);
    },
    addPayment: function (payment) {
      const items = read(KEYS.payments);
      items.unshift({
        id: uid("pay"),
        createdAt: new Date().toISOString(),
        ...payment
      });
      write(KEYS.payments, items);
      return items;
    }
  };

  seed();
  window.DataStore = DataStore;
})();
