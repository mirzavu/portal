import React from 'react';

export default function WebImagePage() {
    const imageUrl = "https://portal.demotesting.co.uk/api/file-transfer/files/b42su04qetr8p8s/_home_mirza_projects_ray_tal_creditapp_redesign_home.html%20(1).png";

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            margin: 0,
            padding: 0,
            height: '100vh',
            width: '100vw',
            backgroundColor: '#000',
            zIndex: 1000,
            overflowY: 'auto',
            overflowX: 'hidden'
        }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={imageUrl}
                alt="Full Screen"
                style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block'
                }}
            />
        </div>
    );
}
