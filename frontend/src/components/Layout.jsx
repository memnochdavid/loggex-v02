import React from 'react';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';

const Layout = ({ children }) => {
  return (
    <div className={styles.container}>
        <div className={styles.mainBody}>
            <Sidebar />
            <main className={styles.content}>
                {children}
            </main>
        </div>
    </div>
  );
};

export default Layout;