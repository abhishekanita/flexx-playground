import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import Panels from '@/features/dashboard/components/panels/panels';
import { BellIcon, PanelRight } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
    const { toggleSidebar } = useSidebar();
    const navigate = useNavigate();

    return (
        <Panels>
            <div className="flex justify-between items-center gap-2 px-3 mt-3 ">
                <div onClick={() => toggleSidebar()} className="">
                    <PanelRight className="size-4 text-muted-foreground" />
                </div>
                <div className="flex gap-2 items-center">
                    <Button className="size-8 rounded-full" variant="outline" size="icon" onClick={() => navigate('/app/notifications')}>
                        <BellIcon className="size-4 text-muted-foreground" />
                    </Button>
                    <Button className="size-8 rounded-full overflow-hidden" variant="outline" size="icon">
                        <img
                            className="w-full h-full object-cover overflow-hidden"
                            src="https://lh3.googleusercontent.com/a-/ALV-UjVSq2Y4yz5XAMLRkDkAbagETzWHQTZD3aBHMxRj0_BxSap_QA0Qpxb43uuSJOJee0EsyXmv__sYfY2ykOEMxnuBQovQht9IE2StTH0CqO8_nxTXwsoqmZgQPRM2YBwK2_c22u-aSSXFoAlrmaNyR2JMN8pj8UchnjGXrmdcGMQxeBBEdK7aAtx6vahhWhl7Cjeko4N8HZY4WHgqKJaL9cRXTHEAGma2zoDesNP0_4aPzkJnEPQIQzTwAbdfvrGQNIFFGAWDwyzrlZwPcspfaYQBtGtqEYB3onuKeHH8uFjQgzo6zHV-bQDBfMOa6j7i9gsqpgEoIs9EwiRW8idDrg1EFqQ0zE_JfWZpeDzVQz8CQQFxlpZ3WRCuyoyoYEJ-8BGIzs6S0sA0UNYUgmBUKeey7eXaynM7AL2N24VSvYyslQykHpbKfjdvEuEMQipQFSBepP0-xSl-gryp5wbX-NdFBVo8nKgO0ladw0hWflb-o-KbiCUeULuqUvZA5cq-E82S--je7sYjZWl-8kb5hWkCunTExn6FQ6VTFg8-aVnxAzfx8wUYUBDy3REUB_V7Q6n_Z0TlU8Iro9gJQUfaWTQFI_k_fI6xGE0adnCz9_If-uwBFNggnXI0AmukOObCWeiidSDHSztdcORqyR6wvlxYMOOC3piPkYcIr3nX6PehBNBE14YdtKs7bHCwP5Nb632J22MsOapQ342UjcTVLnMBWMBtpyr8MzEg5c3R1CbHusCOwnHhoWynj_BunUIeSUOoJ2_h60AiyxIywpNI6aV-iiyrNPMiDKDt2Xi_Nl4KRpTRhx6nbSUiBW5YNsxGBiWauGsYepklJdveao_v5ha7LoX14jEifn5rgEPoY69Z1MQR3R7LHzhzoBpR8TzsIXG1VuoBKiO0r94PBdZ2ls6NrGThCFqjS0ex-5I7ZCbmVEHCWRfGKUq3EuMZvs-1NrcPzkKZLTccmleSfZIUjVUO=s96-c"
                        />
                    </Button>
                </div>
            </div>
            <div className="bg-white h-full">
                <div className="h-full flex flex-col items-center overflow-hidden pt-10 ">{/* <CreateTask /> */}</div>
            </div>
        </Panels>
    );
};

export default HomePage;
